import express from 'express';
import path from 'path';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = 3000;

// Public URL of the Torqued logo for email templates
const LOGO_URL = 'https://torquednz.vercel.app/torqued-logo.png';

// Capture raw body for Stripe webhook signature verification.
// 10mb limit so receipt photo/PDF uploads (base64) aren't rejected.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));

// Lazy-initialized Stripe instance
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe | null {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2023-10-16' as any,
    });
  }
  return stripeInstance;
}

// Lazy-initialized Email Transporter
// Fresh transporter per request. We deliberately do NOT cache across
// invocations: serverless functions freeze between requests, which severs any
// kept-alive SMTP connection and makes the next send fail. `pool` still lets the
// booking flow reuse one connection for its several sends within a single request.
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
  }
  return null;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

function getOrigin(req: express.Request): string {
  if (req.headers.origin && typeof req.headers.origin === 'string') {
    return req.headers.origin;
  }
  if (req.headers.referer && typeof req.headers.referer === 'string') {
    try {
      return new URL(req.headers.referer).origin;
    } catch (e) {}
  }
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${host}`;
}

// ── OTP ─────────────────────────────────────────────────────────────────────
// In-memory store: key = uppercase rego, value = { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// Magic-link tokens for customer verification: token -> { rego, expiresAt }
const magicStore = new Map<string, { rego: string; expiresAt: number }>();

function generateMagicEmailHtml(rego: string, link: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0201;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0201;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#150402;border-radius:20px;overflow:hidden;border:1px solid rgba(255,24,0,.15)">
<tr><td style="background:#050100;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="display:inline-block;width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:40px 32px;text-align:center">
<span style="display:inline-block;background:rgba(255,24,0,.12);color:#FF1800;font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:6px">VEHICLE VERIFICATION</span>
<h1 style="margin:20px 0 8px;font-size:20px;font-weight:900;color:#fff;text-transform:uppercase">Confirm it's you</h1>
<p style="margin:0 0 28px;font-size:13px;color:rgba(255,255,255,.55);line-height:1.5">Tap below to securely access the history for <strong style="color:#fff">${rego}</strong>.</p>
<a href="${link}" style="display:inline-block;background:#FF1800;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;text-decoration:none;padding:15px 36px;border-radius:12px">Verify &amp; Continue</a>
<p style="margin:28px 0 0;font-size:11px;color:rgba(255,255,255,.35);line-height:1.5">Link expires in 15 minutes. Or paste:<br/><a href="${link}" style="color:rgba(255,255,255,.5);word-break:break-all">${link}</a></p>
</td></tr>
<tr><td style="background:#050100;padding:18px 32px;text-align:center"><p style="margin:0;font-size:10px;color:rgba(255,255,255,.3)">Didn't request this? You can ignore this email.</p></td></tr>
</table></td></tr></table></body></html>`;
}

// Create a magic token, email the link, and return delivery info (+ fallback link if email fails)
async function sendMagicLink(rego: string, email: string, origin: string) {
  const token = crypto.randomBytes(24).toString('hex');
  magicStore.set(token, { rego, expiresAt: Date.now() + 15 * 60 * 1000 });
  const link = `${origin}/customer?vt=${token}`;
  let delivered = false;
  const transporter = getMailTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: `Verify your vehicle on Torqued`,
        html: generateMagicEmailHtml(rego, link),
      });
      delivered = true;
    } catch (e) { console.warn('[magic] send failed:', (e as Error)?.message); }
  }
  return { delivered, fallbackLink: delivered ? undefined : link };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, Math.min(3, local.length))}***@${domain}`;
}

function generateOtpEmailHtml(rego: string, code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Torqued Verification Code</title></head>
<body style="margin:0;padding:0;background:#0b0201;font-family:-apple-system,Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0201;padding:32px 8px;">
    <tr><td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;background:#150402;border-radius:20px;border:1px solid rgba(255,24,0,0.15);overflow:hidden;">
        <tr>
          <td style="background:#050100;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center;">
            <img src="${LOGO_URL}" alt="Torqued" width="200" height="67" style="display:inline-block;width:200px;height:67px;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;text-align:center;">
            <span style="display:inline-block;background:rgba(255,24,0,0.12);color:#FF1800;font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:6px;">VEHICLE VERIFICATION</span>
            <h1 style="margin:20px 0 8px;font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;">Your one-time code</h1>
            <p style="margin:0 0 32px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.5;">
              Enter this code to verify ownership of <strong style="color:#fff;">${rego}</strong>
            </p>
            <div style="display:inline-block;background:#FF1800;color:#fff;font-family:monospace;font-size:40px;font-weight:900;letter-spacing:12px;padding:18px 32px;border-radius:14px;">${code}</div>
            <p style="margin:24px 0 0;font-size:11.5px;color:rgba(255,255,255,0.35);">
              Expires in <strong style="color:rgba(255,255,255,0.6);">10 minutes</strong> &bull; one-time use only
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#050100;padding:18px 32px;text-align:center;">
            <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);">Didn't request this? Someone entered your plate number. You can safely ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function generateMechanicConfirmEmailHtml(name: string, link: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Confirm your Torqued account</title></head>
<body style="margin:0;padding:0;background:#0b0201;font-family:-apple-system,Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0201;padding:32px 8px;">
    <tr><td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;background:#150402;border-radius:20px;border:1px solid rgba(255,24,0,0.15);overflow:hidden;">
        <tr>
          <td style="background:#050100;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center;">
            <img src="${LOGO_URL}" alt="Torqued" width="200" height="67" style="display:inline-block;width:200px;height:67px;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;text-align:center;">
            <span style="display:inline-block;background:rgba(255,24,0,0.12);color:#FF1800;font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:6px;">PARTNER HUB</span>
            <h1 style="margin:20px 0 8px;font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;">Confirm your account</h1>
            <p style="margin:0 0 28px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.5;">
              G'day ${name}, welcome to Torqued. Confirm your email to activate your workshop account and start receiving jobs.
            </p>
            <a href="${link}" style="display:inline-block;background:#FF1800;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;text-decoration:none;padding:15px 36px;border-radius:12px;">Confirm Email &amp; Activate</a>
            <p style="margin:28px 0 0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">
              Or paste this link into your browser:<br/>
              <a href="${link}" style="color:rgba(255,255,255,0.5);word-break:break-all;">${link}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#050100;padding:18px 32px;text-align:center;">
            <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);">Didn't sign up? You can safely ignore this email. Questions? torquedapp.nz@gmail.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// GET /api/mechanics — real mechanics (active subscription) for the customer to choose from
app.get('/api/mechanics', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ mechanics: [] });
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'mechanic')
      .eq('subscription_active', true);
    res.json({ mechanics: data ?? [] });
  } catch (err) {
    console.error('[mechanics]', err);
    res.json({ mechanics: [] });
  }
});

// POST /api/customer/check-plate — checks plate, triggers OTP for returning customers
app.post('/api/customer/check-plate', async (req, res) => {
  try {
    const { rego } = req.body;
    if (!rego) return res.status(400).json({ error: 'rego is required' });
    const formattedRego = (rego as string).toUpperCase().trim();

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('rego, owner_id')
      .eq('rego', formattedRego)
      .single();

    if (!vehicle) return res.status(404).json({ error: 'Plate not found in our registry' });

    // New customer — plate exists but no owner
    if (!vehicle.owner_id) {
      return res.json({ found: true, isNew: true });
    }

    // Returning customer — get name and email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', vehicle.owner_id)
      .single();

    const ownerEmail = profile?.email ?? null;
    const customerName = profile?.name ?? null;

    if (!ownerEmail) return res.json({ found: true, isNew: true });

    // Returning customer — email a magic verification link
    const { delivered, fallbackLink } = await sendMagicLink(formattedRego, ownerEmail, getOrigin(req));

    return res.json({
      found: true,
      isNew: false,
      customerName,
      maskedEmail: maskEmail(ownerEmail),
      magicSent: true,
      ...(delivered ? {} : { fallbackLink }),
    });
  } catch (err) {
    console.error('[check-plate]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customer/verify-link?token= — validate a magic link, return the customer's garage
app.get('/api/customer/verify-link', async (req, res) => {
  try {
    const token = req.query.token as string;
    const entry = token ? magicStore.get(token) : null;
    if (!entry) return res.status(400).json({ error: 'This link is invalid or already used.' });
    if (Date.now() > entry.expiresAt) { magicStore.delete(token); return res.status(400).json({ error: 'This link has expired. Please request a new one.' }); }
    magicStore.delete(token); // one-time use

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', entry.rego).single();
    let email: string | null = null, ownerId: string | null = null, vehicles: any[] = [];
    if (vehicle?.owner_id) {
      ownerId = vehicle.owner_id;
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
      email = profile?.email ?? null;
      const { data: rows } = await supabase.from('vehicles')
        .select('rego, make, model, year, variant, mileage, thumbnail').eq('owner_id', ownerId);
      vehicles = rows ?? [];
    }
    res.json({ success: true, rego: entry.rego, email, ownerId, vehicles });
  } catch (err) {
    console.error('[verify-link]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/customer/register — creates a new customer account from plate details
app.post('/api/customer/register', async (req, res) => {
  try {
    const { rego, name, email, phone } = req.body;
    if (!rego || !name || !email) {
      return res.status(400).json({ error: 'rego, name, and email are required' });
    }
    const formattedRego = (rego as string).toUpperCase().trim();

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name, phone, role: 'customer' },
    });

    if (authError) {
      // If user already exists, just link the vehicle
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        await supabase.from('vehicles').update({ owner_id: existing.id }).eq('rego', formattedRego);
        const r = await sendMagicLink(formattedRego, email, getOrigin(req));
        return res.json({ success: true, maskedEmail: maskEmail(email), magicSent: true, ...(r.delivered ? {} : { fallbackLink: r.fallbackLink }) });
      }
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // Create profile
    await supabase.from('profiles').upsert({
      id: userId,
      email,
      name,
      phone: phone || null,
      role: 'customer',
    }, { onConflict: 'id' });

    // Link vehicle to this customer
    await supabase.from('vehicles').update({ owner_id: userId }).eq('rego', formattedRego);

    // Email a magic verification link
    const magic = await sendMagicLink(formattedRego, email, getOrigin(req));
    res.json({ success: true, maskedEmail: maskEmail(email), magicSent: true, ...(magic.delivered ? {} : { fallbackLink: magic.fallbackLink }) });
  } catch (err) {
    console.error('[customer/register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/mechanic/register — creates a pre-confirmed mechanic account (no email link required)
app.post('/api/mechanic/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if ((password as string).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const origin = getOrigin(req);

    // Create the account PRE-CONFIRMED so the mechanic can log in immediately.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'mechanic' },
    });

    if (authError) {
      if (/already|registered|exists/i.test(authError.message)) {
        return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
      }
      return res.status(400).json({ error: authError.message });
    }

    if (authData.user?.id) {
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email,
        name,
        role: 'mechanic',
        subscription_active: false,
      }, { onConflict: 'id' });
    }

    // Branded welcome email with a link straight to the portal (informational, not a gate)
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: 'Welcome to Torqued — your workshop account is ready',
        html: generateMechanicConfirmEmailHtml(name, `${origin}/mechanic`),
      }).catch(e => console.warn('Welcome email failed (non-blocking):', e?.message));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/mechanic/ensure-confirmed — force-confirms an existing account's email
// (heals accounts left unconfirmed by the earlier link flow so login works).
app.post('/api/mechanic/ensure-confirmed', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Find the profile by email to get the user id, then confirm via admin
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();
    if (!profile?.id) return res.json({ confirmed: false });

    await supabase.auth.admin.updateUserById(profile.id, { email_confirm: true });
    res.json({ confirmed: true });
  } catch (err) {
    console.error('[mechanic/ensure-confirmed]', err);
    res.status(500).json({ error: 'Could not confirm account' });
  }
});

// Mechanic subscription promo codes (no card required). Extend this map as needed.
const MECHANIC_PROMOS: Record<string, { trialDays: number; label: string }> = {
  SRITORQUED: { trialDays: 30, label: '30-day free trial' },
};

// POST /api/mechanic/redeem-promo — activate via a promo code, no payment
app.post('/api/mechanic/redeem-promo', async (req, res) => {
  try {
    const { mechanicId, code } = req.body;
    if (!mechanicId || !code) return res.status(400).json({ error: 'mechanicId and code are required' });

    const promo = MECHANIC_PROMOS[String(code).toUpperCase().trim()];
    if (!promo) return res.status(404).json({ error: 'Invalid promo code.' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { error } = await supabase.from('profiles')
      .update({ subscription_active: true })
      .eq('id', mechanicId);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ activated: true, trialDays: promo.trialDays, label: promo.label });
  } catch (err) {
    console.error('[mechanic/redeem-promo]', err);
    res.status(500).json({ error: 'Could not redeem code' });
  }
});

// POST /api/mechanic/email-trial — emails the trial code to a mechanic (sent from prod SMTP)
app.post('/api/mechanic/email-trial', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const transporter = getMailTransporter();
    if (!transporter) return res.status(503).json({ error: 'Email not configured' });

    const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:auto;background:#150402;border-radius:16px;overflow:hidden;border:1px solid rgba(255,24,0,.2)">
<div style="background:#050100;padding:24px;text-align:center;border-bottom:3px solid #FF1800"><img src="${LOGO_URL}" width="180" style="height:auto"/></div>
<div style="padding:32px;color:#fff">
<h2 style="margin:0 0 4px;text-transform:uppercase">Your 30-Day Free Trial</h2>
<p style="color:rgba(255,255,255,.6);font-size:14px">Skip the $99/month subscription — no credit card required.</p>
<div style="background:rgba(255,24,0,.08);border:1px solid rgba(255,24,0,.3);border-radius:12px;padding:18px;margin:20px 0;text-align:center">
<p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.5)">Trial Code</p>
<p style="margin:0;font-family:monospace;font-size:28px;font-weight:900;letter-spacing:4px;color:#FF1800">sritorqued</p>
</div>
<p style="font-size:13px;color:rgba(255,255,255,.7)">Log in at <a href="https://torquednz.vercel.app/mechanic" style="color:#FF1800">torquednz.vercel.app/mechanic</a>, enter <strong>sritorqued</strong> in the promo field on the activation screen, and click Apply — your Garage Hub unlocks instantly.</p>
<a href="https://torquednz.vercel.app/mechanic" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:8px">Open Mechanic Portal</a>
</div></div>`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
      to: email,
      subject: 'Your Torqued 30-day trial code: sritorqued',
      html,
    });
    res.json({ sent: true });
  } catch (err) {
    console.error('[mechanic/email-trial]', err);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// POST /api/mechanic/update-quote — mechanic edits a booking's quote (price + note)
app.post('/api/mechanic/update-quote', async (req, res) => {
  try {
    const { bookingId, quotedPrice, note } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    await supabase.from('bookings').update({
      quoted_price: quotedPrice != null ? Number(quotedPrice) : null,
      quote_note: note || null,
    }).eq('id', bookingId);

    // Email the customer their updated quote
    const { data: b } = await supabase.from('bookings').select('email, vehicle_rego').eq('id', bookingId).single();
    const transporter = getMailTransporter();
    if (b?.email && transporter && quotedPrice != null) {
      const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
<div style="background:#150402;padding:24px;text-align:center"><img src="${LOGO_URL}" width="180" style="height:auto"/></div>
<div style="padding:32px;color:#150402">
<h2 style="margin:0 0 8px">Your updated quote</h2>
<p style="color:#555;font-size:14px">Your workshop has prepared a quote for booking <strong>#${bookingId}</strong>${b.vehicle_rego ? ` (${b.vehicle_rego})` : ''}.</p>
<p style="font-size:30px;font-weight:900;color:#FF1800;margin:16px 0">$${Number(quotedPrice).toFixed(2)}</p>
${note ? `<p style="color:#555;font-size:13px">${note}</p>` : ''}
<a href="https://torquednz.vercel.app/customer" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:12px">View & Book</a>
</div></div>`;
      await transporter.sendMail({ from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>', to: b.email, subject: `Your Torqued quote: $${Number(quotedPrice).toFixed(2)}`, html }).catch(()=>{});
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[update-quote]', err);
    res.status(500).json({ error: 'Could not update quote' });
  }
});

// POST /api/stripe/refund — full or partial refund tied to a booking
app.post('/api/stripe/refund', async (req, res) => {
  try {
    const { bookingId, amount } = req.body; // amount optional (full if omitted)
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();
    if (!stripe || !supabase) return res.status(500).json({ error: 'Not configured' });

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking?.stripe_session_id) return res.status(400).json({ error: 'No payment found for this booking to refund.' });

    const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
    const paymentIntent = session.payment_intent as string;
    if (!paymentIntent) return res.status(400).json({ error: 'No payment intent on this booking.' });

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent,
      ...(amount ? { amount: Math.round(Number(amount) * 100) } : {}),
    });

    const refundedDollars = (refund.amount || 0) / 100;
    await supabase.from('bookings').update({
      refunded_amount: (Number(booking.refunded_amount) || 0) + refundedDollars,
      payment_status: amount ? 'partially_refunded' : 'refunded',
    }).eq('id', bookingId);
    await supabase.from('platform_events').insert({
      type: 'refund', amount: refundedDollars, mechanic_id: booking.mechanic_id, booking_id: bookingId, note: 'Stripe refund',
    });

    res.json({ success: true, refunded: refundedDollars });
  } catch (err) {
    console.error('[refund]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Refund failed' });
  }
});

// ── Reviews ─────────────────────────────────────────────────
// POST /api/reviews/request — mechanic marks a job complete; email the customer a review link
app.post('/api/reviews/request', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: booking } = await supabase
      .from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    await supabase.from('bookings').update({
      status: 'completed', completed_at: new Date().toISOString(), review_requested: true,
    }).eq('id', bookingId);

    const origin = getOrigin(req);
    const reviewUrl = `${origin}/customer?review_booking=${bookingId}&m=${booking.mechanic_id}`;
    const to = booking.email;
    const transporter = getMailTransporter();
    if (to && transporter) {
      const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
<div style="background:#150402;padding:24px;text-align:center"><img src="${LOGO_URL}" width="180" style="height:auto"/></div>
<div style="padding:32px;color:#150402">
<h2 style="margin:0 0 8px">How was your service?</h2>
<p style="color:#555;font-size:14px">Your booking <strong>#${bookingId}</strong> is complete. Leave a quick verified review to help other drivers.</p>
<a href="${reviewUrl}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:12px">Leave a Review</a>
</div></div>`;
      await transporter.sendMail({ from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>', to, subject: 'How was your Torqued service?', html }).catch(()=>{});
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[reviews/request]', err);
    res.status(500).json({ error: 'Could not request review' });
  }
});

// POST /api/reviews/submit — customer submits a verified review
app.post('/api/reviews/submit', async (req, res) => {
  try {
    const { bookingId, mechanicId, rating, comment, email, name } = req.body;
    if (!mechanicId || !rating) return res.status(400).json({ error: 'mechanicId and rating required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    await supabase.from('reviews').insert({
      booking_id: bookingId || null, mechanic_id: mechanicId,
      customer_email: email || null, customer_name: name || null,
      rating: Math.max(1, Math.min(5, parseInt(rating))), comment: comment || null,
    });

    // Recompute the mechanic's aggregate rating
    const { data: all } = await supabase.from('reviews').select('rating').eq('mechanic_id', mechanicId);
    const ratings = (all ?? []).map((r: any) => r.rating);
    const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
    await supabase.from('profiles').update({
      rating: Math.round(avg * 100) / 100, review_count: ratings.length,
    }).eq('id', mechanicId);

    res.json({ success: true });
  } catch (err) {
    console.error('[reviews/submit]', err);
    res.status(500).json({ error: 'Could not submit review' });
  }
});

// GET /api/reviews?mechanicId= — public reviews for a mechanic
app.get('/api/reviews', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    const supabase = getSupabaseAdmin();
    if (!supabase || !mechanicId) return res.json({ reviews: [], average: 0, count: 0 });
    const { data } = await supabase.from('reviews')
      .select('rating, comment, customer_name, created_at')
      .eq('mechanic_id', mechanicId).order('created_at', { ascending: false });
    const ratings = (data ?? []).map((r: any) => r.rating);
    const average = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
    res.json({ reviews: data ?? [], average: Math.round(average * 100) / 100, count: ratings.length });
  } catch (err) {
    console.error('[reviews]', err);
    res.json({ reviews: [], average: 0, count: 0 });
  }
});

// ── Admin back-office (gated by ADMIN_PASSWORD) ─────────────
function adminOk(req: express.Request): boolean {
  const key = (req.query.key as string) || req.body?.key;
  return !!key && key === (process.env.ADMIN_PASSWORD || 'torqued-admin-2026');
}

// GET /api/admin/overview — revenue + platform metrics
app.get('/api/admin/overview', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: mechs } = await supabase.from('profiles').select('id, subscription_active').eq('role', 'mechanic');
    const { data: bookings } = await supabase.from('bookings').select('total_price, status, payment_status, refunded_amount, created_at');
    const { data: customers } = await supabase.from('profiles').select('id').eq('role', 'customer');

    const activeSubs = (mechs ?? []).filter((m: any) => m.subscription_active).length;
    const all = bookings ?? [];
    const completed = all.filter((b: any) => b.status === 'completed' || b.payment_status === 'confirmed');
    const grossBookingValue = completed.reduce((s: number, b: any) => s + (Number(b.total_price) || 0), 0);
    const commission = grossBookingValue * 0.04;
    const subscriptionRevenue = activeSubs * 99;
    const refunds = all.reduce((s: number, b: any) => s + (Number(b.refunded_amount) || 0), 0);
    const net = commission + subscriptionRevenue - refunds;

    // last 7 days booking trend
    const now = Date.now();
    const week = all.filter((b: any) => b.created_at && (now - new Date(b.created_at).getTime()) < 7 * 864e5).length;

    res.json({
      mechanics: (mechs ?? []).length,
      activeSubscriptions: activeSubs,
      customers: (customers ?? []).length,
      totalBookings: all.length,
      completedBookings: completed.length,
      bookingsLast7Days: week,
      grossBookingValue: round2(grossBookingValue),
      commission: round2(commission),
      subscriptionRevenue: round2(subscriptionRevenue),
      refunds: round2(refunds),
      netRevenue: round2(net),
    });
  } catch (err) {
    console.error('[admin/overview]', err);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

function round2(n: number) { return Math.round(n * 100) / 100; }

// GET /api/admin/mechanics — mechanic list with status
app.get('/api/admin/mechanics', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { data } = await supabase.from('profiles')
    .select('id, name, email, subscription_active, rating, review_count, created_at')
    .eq('role', 'mechanic').order('created_at', { ascending: false });
  res.json({ mechanics: data ?? [] });
});

// GET /api/admin/bookings — recent bookings
app.get('/api/admin/bookings', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { data } = await supabase.from('bookings')
    .select('id, vehicle_rego, mechanic_id, total_price, status, payment_status, refunded_amount, created_at')
    .order('created_at', { ascending: false }).limit(50);
  res.json({ bookings: data ?? [] });
});

// POST /api/admin/set-subscription — suspend/reactivate a mechanic
app.post('/api/admin/set-subscription', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { mechanicId, active } = req.body;
  if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { error } = await supabase.from('profiles').update({ subscription_active: !!active }).eq('id', mechanicId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/mechanic/save-onboarding — persist onboarding details (service role)
app.post('/api/mechanic/save-onboarding', async (req, res) => {
  try {
    const { mechanicId, fields, complete } = req.body;
    if (!mechanicId || !fields) return res.status(400).json({ error: 'mechanicId and fields required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const allowed = ['name','nzbn','address','phone','owner_name','bank_account_name','bank_account_number','labour_rate','shop_fee','technicians','parts_lead_days','service_areas'];
    const update: Record<string, any> = {};
    for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
    if (complete) update.onboarding_complete = true;

    const { error } = await supabase.from('profiles').update(update).eq('id', mechanicId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[save-onboarding]', err);
    res.status(500).json({ error: 'Could not save' });
  }
});

// GET /api/mechanic/onboarding-status — has the mechanic completed onboarding?
app.get('/api/mechanic/onboarding-status', async (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ complete: true });
    const { data } = await supabase.from('profiles').select('onboarding_complete').eq('id', id).single();
    res.json({ complete: !!data?.onboarding_complete });
  } catch {
    res.json({ complete: true });
  }
});

// GET /api/mechanic/status — reliable subscription status read (service role, no RLS race)
app.get('/api/mechanic/status', async (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ subscriptionActive: false });
    const { data } = await supabase.from('profiles').select('subscription_active').eq('id', id).single();
    res.json({ subscriptionActive: !!data?.subscription_active });
  } catch (err) {
    console.error('[mechanic/status]', err);
    res.json({ subscriptionActive: false });
  }
});

// POST /api/mechanic/activate — force-activate a mechanic's subscription (service role,
// bypasses RLS so it always persists). Used by the activation/return flows.
app.post('/api/mechanic/activate', async (req, res) => {
  try {
    const { mechanicId, email } = req.body;
    if (!mechanicId && !email) return res.status(400).json({ error: 'mechanicId or email required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    let id = mechanicId;
    if (!id && email) {
      const { data: p } = await supabase.from('profiles').select('id').eq('email', email).single();
      id = p?.id;
    }
    if (!id) return res.status(404).json({ error: 'Mechanic not found' });

    const { error } = await supabase.from('profiles')
      .update({ subscription_active: true })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ activated: true });
  } catch (err) {
    console.error('[mechanic/activate]', err);
    res.status(500).json({ error: 'Activation failed' });
  }
});

// POST /api/mechanic/resend — re-sends a sign-in/confirmation link to an existing mechanic
app.post('/api/mechanic/resend', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const origin = getOrigin(req);
    // A magic link works for an existing (unconfirmed) user: clicking it confirms
    // their email and signs them in, then redirects to the portal.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/mechanic` },
    });

    if (linkError || !linkData.properties?.action_link) {
      return res.status(400).json({ error: linkError?.message || 'Could not generate link. Make sure you signed up first.' });
    }

    const name = (linkData.user?.user_metadata?.name as string) || 'there';
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: 'Your Torqued sign-in link',
        html: generateMechanicConfirmEmailHtml(name, linkData.properties.action_link),
      });
    } else {
      console.log(`[Mechanic resend link] ${email} → ${linkData.properties.action_link}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/resend]', err);
    res.status(500).json({ error: 'Failed to resend link' });
  }
});

// Helper: call OpenAI chat completions. `content` is the user message content
// (string, or an array of parts for vision). Returns the assistant text.
async function callOpenAI(content: any, jsonMode = false): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const body: any = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content }],
    max_tokens: 600,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'OpenAI request failed');
  return data.choices?.[0]?.message?.content ?? '';
}

// POST /api/ai/fault-code — translates a diagnostic fault code via OpenAI
app.post('/api/ai/fault-code', async (req, res) => {
  try {
    const { code, make, model, year, mileage } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ translation: `Interpreting ${code.toUpperCase()}... AI not configured.` });
    }

    const prompt = `You are a concise automotive diagnostic assistant for New Zealand mechanics.
Translate fault code ${String(code).toUpperCase()} for a ${year || ''} ${make || ''} ${model || ''} at ${mileage || 'unknown'} km.
In 1-2 sentences max: what it means, the most likely cause for this vehicle, and what action to take.
Be direct and practical. No disclaimers.`;

    const text = await callOpenAI(prompt);
    res.json({ translation: text.trim() || 'Unable to interpret code.' });
  } catch (err) {
    console.error('[AI fault-code]', err);
    res.status(500).json({ error: 'AI translation failed' });
  }
});

// POST /api/ai/parse-receipt — extracts service history from a receipt image via OpenAI vision
app.post('/api/ai/parse-receipt', async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) return res.status(400).json({ error: 'fileData and mimeType are required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI receipt scanning is not configured yet.' });

    if (String(mimeType).includes('pdf')) {
      return res.status(422).json({ error: 'Please upload a photo of the receipt (JPG/PNG). PDF support is coming soon.' });
    }

    const prompt = `You are an automotive service receipt parser for New Zealand workshops.
Read this service receipt/invoice and extract:
- service: a concise summary of the work performed (e.g. "Oil & filter change, brake pads front")
- date: the service date as written (e.g. "14 Oct 2025")
- mileage: the odometer/mileage in km if shown (digits only, no units)
- provider: the workshop/mechanic business name
- price: the total amount including currency symbol if shown
- notes: any other relevant detail (warranty, parts brands, next-service advice)
Return ONLY a JSON object with keys: service, date, mileage, provider, price, notes.
Use an empty string for anything you cannot find. Do not guess.`;

    const text = await callOpenAI([
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileData}` } },
    ], true);

    let parsed: any = {};
    try { parsed = JSON.parse(text.trim()); }
    catch { return res.status(422).json({ error: 'Could not read the receipt. Try a clearer photo.' }); }

    res.json({
      service: parsed.service || '',
      date: parsed.date || '',
      mileage: parsed.mileage || '',
      provider: parsed.provider || '',
      price: parsed.price || '',
      notes: parsed.notes || '',
    });
  } catch (err) {
    console.error('[AI parse-receipt]', err);
    res.status(500).json({ error: 'Failed to scan receipt' });
  }
});

// POST /api/otp/send — checks plate, sends OTP only if there's a registered owner
app.post('/api/otp/send', async (req, res) => {
  try {
    const { rego } = req.body;
    if (!rego) return res.status(400).json({ error: 'rego is required' });
    const formattedRego = (rego as string).toUpperCase().trim();

    const supabase = getSupabaseAdmin();
    let vehicleExists = false;
    let ownerEmail: string | null = null;

    if (supabase) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('rego, owner_id')
        .eq('rego', formattedRego)
        .single();

      if (vehicle) {
        vehicleExists = true;
        if (vehicle.owner_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', vehicle.owner_id)
            .single();
          ownerEmail = profile?.email ?? null;
        }
      }
    }

    if (!vehicleExists) {
      return res.status(404).json({ error: 'Plate not found in our registry' });
    }

    // Vehicle exists but no registered owner — skip OTP, load directly
    if (!ownerEmail) {
      return res.json({ requiresOtp: false });
    }

    // Generate 6-digit OTP and store for 10 minutes
    const code = crypto.randomInt(100000, 999999).toString();
    otpStore.set(formattedRego, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    // Send email
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: ownerEmail,
        subject: `${code} is your Torqued verification code`,
        html: generateOtpEmailHtml(formattedRego, code),
      });
    } else {
      // Dev fallback — print to console if SMTP not configured
      console.log(`[OTP] ${formattedRego} → ${code} (SMTP not configured, not sent)`);
    }

    res.json({ requiresOtp: true, maskedEmail: maskEmail(ownerEmail!) });
  } catch (err) {
    console.error('[OTP send]', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// GET /api/vehicles/:rego — returns vehicle + specs (called after OTP or when no owner)
app.get('/api/vehicles/:rego', async (req, res) => {
  const formattedRego = req.params.rego.toUpperCase().trim();
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('vehicles')
    .select('*, vehicle_specs(*)')
    .eq('rego', formattedRego)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
});

// POST /api/otp/verify — validates code, clears it, and returns the owner's email
app.post('/api/otp/verify', async (req, res) => {
  const { rego, code } = req.body;
  if (!rego || !code) return res.status(400).json({ success: false, error: 'rego and code are required' });

  const formattedRego = (rego as string).toUpperCase().trim();
  const entry = otpStore.get(formattedRego);

  if (!entry) {
    return res.json({ success: false, error: 'No code was sent for this plate. Please request a new one.' });
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(formattedRego);
    return res.json({ success: false, error: 'Code has expired. Please request a new one.' });
  }
  if (entry.code !== (code as string).trim()) {
    return res.json({ success: false, error: 'Incorrect code. Please try again.' });
  }

  otpStore.delete(formattedRego); // One-time use

  // Return the verified owner's email, id, and ALL their vehicles (the garage)
  let email: string | null = null;
  let ownerId: string | null = null;
  let vehicles: any[] = [];
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', formattedRego).single();
    if (vehicle?.owner_id) {
      ownerId = vehicle.owner_id;
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
      email = profile?.email ?? null;
      const { data: rows } = await supabase
        .from('vehicles')
        .select('rego, make, model, year, variant, mileage, thumbnail')
        .eq('owner_id', ownerId);
      vehicles = rows ?? [];
    }
  }

  res.json({ success: true, email, ownerId, vehicles });
});

// POST /api/customer/add-vehicle — claim/add a plate to an existing customer's garage
app.post('/api/customer/add-vehicle', async (req, res) => {
  try {
    const { ownerId, rego, make, model, year, variant, mileage } = req.body;
    if (!ownerId || !rego) return res.status(400).json({ error: 'ownerId and rego are required' });
    const formattedRego = (rego as string).toUpperCase().trim();

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: existing } = await supabase
      .from('vehicles').select('rego, owner_id').eq('rego', formattedRego).single();

    if (existing) {
      if (existing.owner_id && existing.owner_id !== ownerId) {
        return res.status(409).json({ error: 'This plate is already registered to another account.' });
      }
      await supabase.from('vehicles').update({ owner_id: ownerId }).eq('rego', formattedRego);
    } else {
      // Not in registry yet — create a minimal record owned by this customer
      await supabase.from('vehicles').insert({
        rego: formattedRego,
        owner_id: ownerId,
        make: make || 'Unknown',
        model: model || 'Vehicle',
        year: year || new Date().getFullYear(),
        variant: variant || null,
        mileage: mileage || 0,
      });
    }

    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('rego, make, model, year, variant, mileage, thumbnail')
      .eq('rego', formattedRego).single();

    res.json({ success: true, vehicle });
  } catch (err) {
    console.error('[customer/add-vehicle]', err);
    res.status(500).json({ error: 'Could not add vehicle' });
  }
});

// ── Stripe Webhook — must be registered before any routes that need parsed JSON bodies
app.post('/api/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  if (!rawBody) {
    return res.status(400).json({ error: 'Missing raw body — ensure express.json verify is active' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err instanceof Error ? err.message : err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Signature mismatch'}`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('[Webhook] Supabase admin not configured — event received but not persisted:', event.type);
    return res.json({ received: true });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { type, bookingId, mechanicId } = session.metadata ?? {};

      if (type === 'repair_payment' && bookingId) {
        const { error } = await supabase.from('bookings').update({
          payment_status: 'confirmed',
          status: 'booked',
          stripe_session_id: session.id,
          email: session.customer_details?.email ?? null,
          customer_name: session.customer_details?.name ?? null,
          phone: session.customer_details?.phone ?? null,
        }).eq('id', bookingId);
        if (error) console.error('[Webhook] Failed to update booking:', error.message);
        else console.log(`[Webhook] Booking ${bookingId} confirmed via payment`);
      }

      if (type === 'subscription' && mechanicId) {
        const { error } = await supabase.from('profiles').update({
          subscription_active: true,
          stripe_subscription_id: (session.subscription as string) ?? null,
        }).eq('id', mechanicId);
        if (error) console.error('[Webhook] Failed to activate mechanic subscription:', error.message);
        else console.log(`[Webhook] Mechanic ${mechanicId} subscription activated`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('profiles').update({
        subscription_active: sub.status === 'active',
      }).eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('profiles').update({
        subscription_active: false,
        stripe_subscription_id: null,
      }).eq('stripe_subscription_id', sub.id);
      console.log(`[Webhook] Subscription ${sub.id} cancelled — mechanic deactivated`);
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// REST API Endpoints

// Endpoint 1: Create Stripe Checkout Session for Mechanic Subscription
app.post('/api/stripe/create-subscription', async (req, res) => {
  try {
    const { email, mechanicId } = req.body;
    if (!email || !mechanicId) {
      return res.status(400).json({ error: 'Email and mechanicId are required' });
    }

    const stripe = getStripe();
    const origin = getOrigin(req);

    if (!stripe) {
      // Return a simulated mock session URL if Stripe key is not set
      console.log('Stripe API Key missing. Falling back to mock Checkout URL.');
      return res.json({
        id: 'mock_sub_session_id',
        url: `${origin}/mechanic?session_id=mock_sub_session_id&mechanic_id=${mechanicId}`,
        isMock: true
      });
    }

    // Create checkout session for subscription ($99 NZD monthly)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true, // promo code field on the subscription checkout
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            recurring: { interval: 'month' },
            product_data: {
              name: 'Torqued Garage Portal Subscription',
              description: 'Access to NZ-wide high-value repair marketplace leads',
            },
            unit_amount: 9900, // $99.00 NZD
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/mechanic?session_id={CHECKOUT_SESSION_ID}&mechanic_id=${mechanicId}`,
      cancel_url: `${origin}/mechanic?canceled=true`,
      customer_email: email,
      metadata: {
        mechanicId,
        type: 'subscription'
      }
    } as any);

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Error creating Stripe subscription session:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
});

// POST /api/stripe/activate-subscription — verifies a paid checkout session and
// activates the mechanic's subscription server-side (service role, no RLS race).
app.post('/api/stripe/activate-subscription', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    const mechanicId = session.metadata?.mechanicId;

    if (!paid) return res.json({ activated: false, reason: 'not_paid' });
    if (!mechanicId) return res.json({ activated: false, reason: 'no_mechanic' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { error } = await supabase.from('profiles').update({
      subscription_active: true,
      stripe_subscription_id: (session.subscription as string) || null,
    }).eq('id', mechanicId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ activated: true });
  } catch (err) {
    console.error('[activate-subscription]', err);
    res.status(500).json({ error: 'Activation failed' });
  }
});


// Generates a beautiful HTML booking confirmation matching Torqued's design language
function generateBookingEmailHtml(data: any): string {
  const {
    customerName,
    bookingId,
    date,
    time,
    readyTime,
    vehicle,
    plate,
    mechanicName,
    mechanicAddress,
    paymentMethod,
    services,
    price,
    paymentOption,
    depositPaid,
    promoApplied,
    promoDiscount
  } = data;

  const servicesListHtml = (services || []).map((s: string) => `
    <tr style="border-bottom: 1px solid rgba(21, 4, 2, 0.08);">
      <td style="padding: 14px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 13.5px; font-weight: bold; color: #150402; text-transform: uppercase; border-bottom: 1px solid rgba(21, 4, 2, 0.06);">
        ${s}
      </td>
      <td style="padding: 14px 0; text-align: right; font-family: monospace; font-size: 13.5px; font-weight: bold; color: #150402; border-bottom: 1px solid rgba(21, 4, 2, 0.06);">
        INCLUDED
      </td>
    </tr>
  `).join('');

  const finalPrice = promoApplied ? Math.max(0, parseFloat(price) - parseFloat(promoDiscount)) : parseFloat(price);
  
  const discountHtml = promoApplied ? `
    <tr>
      <td style="padding: 12px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #FF1800; text-transform: uppercase;">
        PROMO DISCOUNT (TORQUED219)
      </td>
      <td style="padding: 12px 0; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #FF1800;">
        -$${parseFloat(promoDiscount).toFixed(2)}
      </td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - Torqued NZ</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f9; -webkit-font-smoothing: antialiased; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f7f7f9;">
    <tr>
      <td align="center" style="padding: 24px 8px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 40px rgba(21,4,2,0.06); border: 1px solid rgba(21,4,2,0.05);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background-color: #150402; padding: 28px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" alt="Torqued" width="220" height="74" style="display:inline-block;width:220px;height:74px;border:0;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <span style="font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.5); letter-spacing: 2px; text-transform: uppercase;">
                      NZ REPAIR MARKETPLACE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BOOKING COVER BANNER -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <span style="display: inline-block; background-color: rgba(255, 24, 0, 0.08); color: #FF1800; font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 12px; border-radius: 8px; margin-bottom: 12px;">
                REPAIR SECURED & CONFIRMED
              </span>
              <h1 style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 24px; font-weight: 900; color: #150402; letter-spacing: -0.5px; text-transform: uppercase; line-height: 1.1;">
                REF: #${bookingId}
              </h1>
              <p style="margin: 8px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 13.5px; color: rgba(21,4,2,0.65); font-weight: 500; line-height: 1.4;">
                Thank you, ${customerName}. Your scheduling has been locked in and payment has been processed successfully.
              </p>
            </td>
          </tr>

          <!-- SERVICE GRID CARD -->
          <tr>
            <td style="padding: 0 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(21, 4, 2, 0.015); border: 1px solid rgba(21,4,2,0.05); border-radius: 16px; padding: 20px;">
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 12px; border-bottom: 1px solid rgba(21, 4, 2, 0.06);">
                          <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">VEHICLE REGISTERED</p>
                          <p style="margin: 4px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 14.5px; font-weight: bold; color: #150402; text-transform: uppercase;">
                            ${vehicle} <span style="font-family: monospace; font-size: 12.5px; font-weight: bold; color: #FF1800; background-color: rgba(255,24,0,0.08); padding: 1.5px 5px; border-radius: 4px; margin-left: 6px; display: inline-block; vertical-align: middle;">${plate}</span>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px;">
                          <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">ASSIGNED SPECIALIST</p>
                          <p style="margin: 4px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 14.5px; font-weight: bold; color: #150402; text-transform: uppercase;">
                            ${mechanicName}
                          </p>
                          <p style="margin: 2px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: rgba(21,4,2,0.5); font-weight: 500;">
                            📍 ${mechanicAddress}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TIMELINE LOGISTICS -->
          <tr>
            <td style="padding: 16px 32px 0 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="48%" style="vertical-align: top; background-color: rgba(21, 4, 2, 0.015); border: 1px solid rgba(21,4,2,0.05); border-radius: 16px; padding: 16px;">
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">Drop-Off Date</p>
                    <p style="margin: 6px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 12.5px; font-weight: bold; color: #150402; text-transform: uppercase;">
                      ${date}
                    </p>
                    <p style="margin: 2px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 16px; font-weight: 900; color: #FF1800;">
                      @ ${time}
                    </p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="vertical-align: top; background-color: rgba(21, 4, 2, 0.015); border: 1px solid rgba(21,4,2,0.05); border-radius: 16px; padding: 16px;">
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">Estimated Pick-up</p>
                    <p style="margin: 6px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 12.5px; font-weight: bold; color: #150402; text-transform: uppercase;">
                      Same-Day Service
                    </p>
                    <p style="margin: 2px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 16px; font-weight: 900; color: #150402;">
                      ${readyTime}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- INVOICE LINE ITEMS -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <h3 style="margin: 0 0 8px 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #150402; letter-spacing: 1px; text-transform: uppercase;">Selected Coverages & Services</h3>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                ${servicesListHtml}
                ${discountHtml}
                <tr>
                  <td style="padding: 16px 0; font-family: -apple-system, Arial, sans-serif; font-size: 13.5px; font-weight: bold; color: #150402; text-transform: uppercase;">
                    Total Price Today (GST incl.)
                  </td>
                  <td style="padding: 16px 0; text-align: right; font-family: monospace; font-size: 21px; font-weight: 900; color: #150402;">
                    $${finalPrice.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 4px;">
                    <div style="background-color: #150402; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-family: -apple-system, Arial, sans-serif; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block; vertical-align: middle;">
                      GATEWAY: ${paymentMethod}
                    </div>
                    ${paymentOption === 'deposit' ? `
                      <span style="display:inline-block; margin-left:8px; font-size:11px; font-weight:bold; color:#FF1800; vertical-align: middle;">(Paid $${parseFloat(depositPaid || '0').toFixed(2)} Deposit Today)</span>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DROP-OFF CHECKLIST -->
          <tr>
            <td style="padding: 30px 32px 10px 32px;">
              <div style="border-top: 1px solid rgba(21, 4, 2, 0.06); padding-top: 24px;">
                <h4 style="margin: 0 0 8px 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #150402; letter-spacing: 1px; text-transform: uppercase;">📌 Drop-Off Checklist</h4>
                <ul style="margin: 0; padding-left: 16px; font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: rgba(21,4,2,0.65); line-height: 1.5; font-weight: 500;">
                  <li style="margin-bottom: 5px;">Drive directly to <strong>${mechanicName}</strong> located at <em>${mechanicAddress}</em>.</li>
                  <li style="margin-bottom: 5px;">Leave lock keys and anti-theft nut adapters in the vehicle console.</li>
                  <li style="margin-bottom: 5px;">If you have specialized instructions, let your assigned service technician know at the reception desk.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- FOOTER DETAILS -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; text-align: center; border-top: 1px solid rgba(21,4,2,0.04); background-color: rgba(21, 4, 2, 0.005);">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">
                Need help or modifications?
              </p>
              <p style="margin: 3px 0 12px 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #FF1800;">
                torquedapp.nz@gmail.com • 022 389 5249
              </p>
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; color: rgba(21,4,2,0.45); font-weight: 500; line-height: 1.4;">
                This automated booking is generated through Torqued. All transactions are secure and PCI-DSS compliant. All fees include 15% NZ GST. 
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generates a beautiful HTML booking notice for partner workshops
function generateMechanicEmailHtml(data: any): string {
  const {
    customerName,
    bookingId,
    date,
    time,
    readyTime,
    vehicle,
    plate,
    mechanicName,
    paymentMethod,
    services,
    price,
    paymentOption,
    depositPaid,
    promoApplied,
    promoDiscount
  } = data;

  const servicesListHtml = (services || []).map((s: string) => `
    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
      <td style="padding: 12px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 13px; font-weight: bold; color: rgba(255, 255, 255, 0.9); text-transform: uppercase;">
        🛠️ ${s}
      </td>
      <td style="padding: 12px 0; text-align: right; font-family: monospace; font-size: 12px; font-weight: bold; color: #FF1800;">
        REQUIRED
      </td>
    </tr>
  `).join('');

  const finalPrice = promoApplied ? Math.max(0, parseFloat(price) - parseFloat(promoDiscount)) : parseFloat(price);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Job Dispatched - Torqued Mechanic Portal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0201; -webkit-font-smoothing: antialiased; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0b0201;">
    <tr>
      <td align="center" style="padding: 24px 8px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #150402; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255, 24, 0, 0.15);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background-color: #050100; padding: 28px 32px; border-bottom: 3px solid #FF1800; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="Torqued" width="180" height="60" style="display:inline-block;width:180px;height:60px;border:0;vertical-align:middle;" />
                    <span style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; font-weight: normal; color: rgba(255,255,255,0.6); margin-left: 10px; vertical-align:middle;">PARTNER HUB</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- COVER HERO -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              <span style="display: inline-block; background-color: rgba(255, 24, 0, 0.15); color: #FF1800; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 12px; border-radius: 6px; margin-bottom: 14px;">
                HIGH-VALUE MECHANICAL LEAD STATUS: SECURED
              </span>
              <h1 style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 22px; font-weight: 950; color: #ffffff; text-transform: uppercase; letter-spacing: -0.5px;">
                NEW JOB DISPATCH: #${bookingId}
              </h1>
              <p style="margin: 10px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 13.5px; color: rgba(255,255,255,0.7); line-height: 1.5;">
                G'day Team, a new client booking has been scheduled for your workshop, <strong>${mechanicName}</strong>. Client detail validation and payment processing are fully settled on client confirmation.
              </p>
            </td>
          </tr>

          <!-- LOGISTICS / STATS -->
          <tr>
            <td style="padding: 0 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 22px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 12px 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #FF1800; letter-spacing: 1px; text-transform: uppercase;">VEHICLE & OWNER ENROLLED</h3>
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #ffffff;">
                      ${vehicle}
                    </p>
                    <p style="margin: 4px 0 14px 0;">
                      <span style="font-family: monospace; font-size: 14.5px; font-weight: bold; color: #ffffff; background-color: #FF1800; padding: 3px 8px; border-radius: 6px;">${plate}</span>
                    </p>
                    
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; margin-top: 6px;">
                      <tr>
                        <td width="50%">
                          <span style="font-family: -apple-system, Arial, sans-serif; font-size: 9px; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: bold;">Drop-Off Window</span>
                          <p style="margin: 4px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #ffffff; text-transform: uppercase;">${date}</p>
                          <p style="margin: 1px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 15px; font-weight: 900; color: #FF1800;">@ ${time}</p>
                        </td>
                        <td width="50%">
                          <span style="font-family: -apple-system, Arial, sans-serif; font-size: 9px; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: bold;">Client Owner</span>
                          <p style="margin: 4px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #ffffff;">${customerName}</p>
                          <p style="margin: 1.5px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; color: rgba(255,255,255,0.5);">${data.email || 'customer@torqued.nz'}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- WORK REQUIREMENTS -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <h3 style="margin: 0 0 8px 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: rgba(255,255,255,0.5); letter-spacing: 1px; text-transform: uppercase;">LABOUR / SPECIALIST INSTRUCTIONS</h3>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                ${servicesListHtml}
                <tr>
                  <td style="padding: 16px 0 10px 0; font-family: -apple-system, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #ffffff;">
                    Dismantle / Install Target Code Workscope Price:
                  </td>
                  <td style="padding: 16px 0 10px 0; text-align: right; font-family: monospace; font-size: 18px; font-weight: 900; color: #FF1800;">
                    $${parseFloat(price).toFixed(2)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>


          <!-- CONTACT FOOTER -->
          <tr>
            <td style="background-color: #050100; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; color: rgba(255,255,255,0.45); font-weight: 500;">
                Questions? torquedapp.nz@gmail.com or 022 389 5249
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generates a beautiful HTML drop-off reminder sent 12 hours before schedule
function generateDropoffReminderEmailHtml(data: any): string {
  const {
    customerName,
    bookingId,
    date,
    time,
    vehicle,
    plate,
    mechanicName,
    mechanicAddress
  } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Dropoff is in 12 Hours - Torqued NZ</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f9; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f9; padding: 24px 8px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.06); border: 1px solid rgba(21,4,2,0.05);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background-color: #150402; padding: 28px; text-align: center;">
              <img src="${LOGO_URL}" alt="Torqued" width="200" height="67" style="display:inline-block;width:200px;height:67px;border:0;" />
            </td>
          </tr>

          <!-- HERO BANNER -->
          <tr>
            <td style="padding: 32px; text-align: center;">
              <span style="background-color: #FF1800; color: #ffffff; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; font-weight: 900; letter-spacing: 2.5px; text-transform: uppercase; padding: 6px 14px; border-radius: 6px;">
                ⏰ 12 HOURS UNTIL DROPOFF
              </span>
              <h1 style="margin: 16px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 22px; font-weight: 900; color: #150402;">
                PREPARE YOUR VEHICLE DROP
              </h1>
              <p style="margin: 8px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 13.5px; color: rgba(21,4,2,0.65); line-height: 1.4;">
                Hi ${customerName}, this is our automated 12-hour dropoff reminder for vehicle <strong>${vehicle}</strong> (Ref: <strong>#${bookingId}</strong>).
              </p>
            </td>
          </tr>

          <!-- TIMING CARD -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 24, 0, 0.03); border: 1px solid rgba(255, 24, 0, 0.1); border-radius: 16px; padding: 20px; text-align: center;">
                <tr>
                  <td>
                    <span style="display: block; font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">SCHEDULED APPOINTMENT TIME</span>
                    <p style="margin: 8px 0 4px 0; font-family: -apple-system, Arial, sans-serif; font-size: 18px; font-weight: 950; color: #150402; text-transform: uppercase;">${date}</p>
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 24px; font-weight: 950; color: #FF1800;">@ ${time}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ADDRESS & CHECKLIST -->
          <tr>
            <td style="padding: 0 32px 32px 32px; font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #150402;">
              <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: bold; color: #150402; letter-spacing: 1px; text-transform: uppercase;">📍 Workshop Location</h3>
              <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: bold; color: #150402;">
                ${mechanicName} <br />
                <span style="font-size: 12.5px; color: rgba(21,4,2,0.6); font-weight: normal;">📍 ${mechanicAddress}</span>
              </p>

              <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: bold; color: #150402; letter-spacing: 1px; text-transform: uppercase;">📌 Drop-Off Checklist</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: rgba(21,4,2,0.7); font-weight: 500;">
                <li style="margin-bottom: 6px;">Arrive at your booked drop-off time.</li>
                <li style="margin-bottom: 6px;">Leave special wheel lock nuts or service logbooks in your vehicle console.</li>
              </ul>
            </td>
          </tr>

          <!-- CONTACT -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; text-align: center; border-top: 1px solid rgba(21,4,2,0.04); background-color: rgba(21, 4, 2, 0.015);">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">SUPPORT & LOGISTICS</p>
              <p style="margin: 3px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #FF1800;">022 389 5249 • torquedapp.nz@gmail.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generates an elegant HTML 12-Month Scheduled Service Reminder with an Unsubscribe Button in the footer
function generateServiceReminderEmailHtml(data: any): string {
  const {
    customerName,
    vehicle,
    plate,
    mechanicName
  } = data;

  const emailStr = data.email || 'customer@torqued.nz';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Service Reminder: scheduled DCT calibration due - Torqued NZ</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050100; -webkit-font-smoothing: antialiased; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #050100; padding: 24px 8px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #150402; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.6); border: 1px solid rgba(255, 24, 0, 0.1);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center;">
              <img src="${LOGO_URL}" alt="Torqued" width="200" height="67" style="display:inline-block;width:200px;height:67px;border:0;" />
            </td>
          </tr>

          <!-- COVER BANNER -->
          <tr>
            <td style="padding: 0 32px 24px 32px; text-align: center;">
              <span style="background-color: #FF1800; color: #ffffff; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 14px; border-radius: 6px;">
                🔧 MAINTENANCE ADVISORY SERVICE
              </span>
              <h1 style="margin: 18px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 22px; font-weight: 955; color: #ffffff; uppercase; letter-spacing: -0.5px; line-height: 1.1;">
                DCT CALIBRATION SCHEDULE REACHED
              </h1>
              <p style="margin: 10px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 13.5px; color: rgba(255,255,255,0.7); line-height: 1.5;">
                G'day ${customerName}, it's time for scheduled maintenance. We recommend a <strong>12-month dual-clutch transmission (DCT) mechatronics calibration</strong> for your <strong>${vehicle} (${plate})</strong> to ensure perfect shift pressures.
              </p>
            </td>
          </tr>

          <!-- CALL TO ACTION -->
          <tr>
            <td style="padding: 0 32px 32px 32px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px 0; font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #ffffff; font-weight: bold;">
                      Secure priority booking at <strong>${mechanicName}</strong>
                    </p>
                    <a href="https://torqued.nz/booking" style="display: inline-block; background-color: #FF1800; color: #ffffff; font-family: -apple-system, Arial, sans-serif; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding: 12px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 6px 20px rgba(255, 24, 0, 0.25);">
                      Schedule 12-Month Service
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>


          <!-- FOOTER WITH SERVICE UN-SUBSCRIBE CONTROL (REQUIRED BY NZ CAN-SPAM COMPLIANCE) -->
          <tr>
            <td style="background-color: #050100; padding: 30px 32px; text-align: center; border-top: 1px solid rgba(255,255,255,0.03);">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; color: rgba(255,255,255,0.4); line-weight: 1.4;">
                This communication is generated through Torqued. All advisory bulletins are aligned with New Zealand manufacturer standards.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 18px;">
                <tr>
                  <td align="center">
                    <a href="https://torqued.nz/unsubscribe?email=${encodeURIComponent(emailStr)}" style="display: inline-block; color: rgba(255,255,255,0.35); font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; outline: none; border: 1px solid rgba(255,255,255,0.08); background-color: rgba(255,255,255,0.01); text-decoration: none; padding: 6px 14px; border-radius: 8px;">
                      🔕 Unsubscribe from vehicles reminders
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Helper to identify placeholder/mock emails so we don't lock the Stripe Checkout fields
const isPlaceholderEmail = (email: string) => {
  if (!email) return true;
  const e = email.toLowerCase().trim();
  return e === 'customer@torqued.nz' || e.endsWith('@torqued.nz') || e === 'user@example.com' || e === '';
};

// Endpoint 2: Create Stripe Checkout Session for Consumer Repair Fee / Deposit
app.post('/api/stripe/create-payment', async (req, res) => {
  try {
    const { amount, bookingId, customerEmail, description, bookingData, userId } = req.body;
    if (!amount || !bookingId) {
      return res.status(400).json({ error: 'Amount and bookingId are required' });
    }

    const stripe = getStripe();
    const origin = getOrigin(req);

    if (!stripe) {
      // Fallback checkout link for our client portal simulation
      console.log('Stripe API Key missing. Returning simulation Link.');
      return res.json({
        id: 'mock_payment_session_id',
        url: `${origin}/customer?session_id=mock_payment_session_id&booking_id=${bookingId}`,
        isMock: true
      });
    }

    // Persist booking to Supabase before redirecting to Stripe.
    // The webhook updates it to confirmed once payment completes.
    if (bookingData && userId) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase.from('bookings').upsert({
          id: bookingId,
          customer_id: userId,
          mechanic_id: bookingData.mechanicId,
          vehicle_rego: bookingData.vehicleId || null,
          service_ids: bookingData.serviceIds || [],
          status: 'pending_payment',
          payment_status: 'pending',
          payment_method: bookingData.paymentMethod || null,
          date: bookingData.date || null,
          total_price: bookingData.totalPrice || 0,
          deposit_paid: bookingData.depositPaid ?? null,
        }, { onConflict: 'id' });
        if (error) console.error('[create-payment] Failed to persist booking:', error.message);
      }
    }


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'afterpay_clearpay', 'klarna'],
      mode: 'payment',
      allow_promotion_codes: true, // shows the "Add promotion code" field on Stripe's hosted checkout
      phone_number_collection: {
        enabled: true,
      },
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: description || 'Torqued Booking Payment',
              description: `Booking Reference: ${bookingId}`,
            },
            unit_amount: Math.round(amount * 100), // convert to cents
          },
          quantity: 1,
        },
      ],

      success_url: `${origin}/customer?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
      cancel_url: `${origin}/customer?canceled=true`,
      customer_email: isPlaceholderEmail(customerEmail) ? undefined : customerEmail.trim(),
      metadata: {
        bookingId,
        type: 'repair_payment'
      }
    } as any);

    // Store the session id on the booking so refunds work even without webhooks
    if (bookingData && userId) {
      const sb = getSupabaseAdmin();
      if (sb) await sb.from('bookings').update({ stripe_session_id: session.id }).eq('id', bookingId);
    }

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Error creating Stripe payment session:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
});

// Endpoint 2.5: Verify Stripe Session
app.get('/api/stripe/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const stripe = getStripe();
    if (!stripe || session_id === 'mock_payment_session_id') {
      return res.json({
        status: 'succeeded',
        email: 'authenticated_customer@torqued.nz',
        message: 'Mock verification success'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id as string);
    res.json({
      status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
      email: session.customer_details?.email || session.customer_email || null,
      name: session.customer_details?.name || null,
      phone: session.customer_details?.phone || null,
      metadata: session.metadata
    });
  } catch (err) {
    console.error('Error verifying Stripe session:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
});

// Endpoint 3: Dynamic HTML Email Sender Matching Torqued Design language
app.post('/api/email/confirm-booking', async (req, res) => {
  try {
    const data = req.body;
    const recipientEmail = data.email || 'customer@torqued.nz';
    
    // Generate beautiful racing red themed HTML email confirmations and reminders
    const emailHtmlHtml = generateBookingEmailHtml(data);
    const mechanicHtml = generateMechanicEmailHtml(data);
    const dropoffHtml = generateDropoffReminderEmailHtml(data);
    const serviceReminderHtml = generateServiceReminderEmailHtml(data);
    const smsText = `TORQUED: Booking Ref #${data.bookingId} is confirmed at ${data.mechanicName}! Drop off your vehicle (${data.vehicle} - ${data.plate}) on ${data.date} at ${data.time} at ${data.mechanicAddress}.`;

    // Initialise mail SMTP transporter if present in environment settings
    const transporter = getMailTransporter();
    let sentRealEmail = false;

    if (transporter) {
      try {
        const fromAddress = process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>';
        
        // Dispatch Customer Confirmation Email
        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `Booking Confirmed: Ref #${data.bookingId} (${data.vehicle})`,
          html: emailHtmlHtml
        });

        // Dispatch Mechanic alert
        const mechanicSafeEmail = data.mechanicName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@torqued-partner.co.nz';
        await transporter.sendMail({
          from: fromAddress,
          to: mechanicSafeEmail,
          subject: `[New Torqued Booking Received] Ref #${data.bookingId} - ${data.vehicle} (${data.plate})`,
          html: mechanicHtml
        });

        // Dispatch Dropoff 12h Reminder
        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `⏰ Live Reminder: Drop-off In 12 Hours for Booking Ref #${data.bookingId}`,
          html: dropoffHtml
        });

        // Dispatch 12-Month Service Reminder
        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `🔧 Performance Service Advisory: Scheduled Maintenance for ${data.vehicle}`,
          html: serviceReminderHtml
        });

        sentRealEmail = true;
        console.log(`Live confirmation HTML emails securely delivered to client ${recipientEmail} and partner ${mechanicSafeEmail}`);
      } catch (smtpErr) {
        console.error('SMTP live booking dispatch failed, falling back to simulated output:', smtpErr);
        return res.json({
          success: true,
          sentRealEmail: false,
          smtpError: smtpErr instanceof Error ? smtpErr.message : 'SMTP Connection Error',
          recipient: recipientEmail,
          html: emailHtmlHtml,
          mechanicHtml,
          dropoffHtml,
          serviceReminderHtml,
          smsText
        });
      }
    } else {
      console.log('\n--- [SIMULATED ELECTRONIC DELIVERY] ---');
      console.log(`To: ${recipientEmail}`);
      console.log(`Subject: Booking Confirmed: Ref #${data.bookingId}`);
      console.log(`SMS: ${smsText}`);
      console.log('-----------------------------------------\n');
    }

    res.json({
      success: true,
      sentRealEmail,
      recipient: recipientEmail,
      html: emailHtmlHtml,
      mechanicHtml,
      dropoffHtml,
      serviceReminderHtml,
      smsText
    });
  } catch (err) {
    console.error('Error initiating email dispatch:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to dispatch email conformation' });
  }
});

// Endpoint 4: Direct Single Template Email Dispatch Test
app.post('/api/email/send-test-single', async (req, res) => {
  try {
    const { recipient, templateType, bookingData } = req.body;
    if (!recipient || !templateType) {
      return res.status(400).json({ error: 'recipient and templateType are required' });
    }

    const defaultData = {
      customerName: 'Sri',
      bookingId: 'TQ-998A-DNDN',
      date: 'Tuesday, 26 May 2026',
      time: '09:00 AM',
      readyTime: '04:30 PM',
      vehicle: 'Audi R8 V10 Plus',
      plate: 'RAH190',
      mechanicName: 'your selected mechanic',
      mechanicAddress: 'your mechanics address',
      paymentMethod: 'Credit / Debit',
      services: ['Full Dual-Clutch Transmission (DCT) Service & Calibration', 'Europack Haldex Fluid Refresh', 'Custom Diagnostics Audit'],
      price: '349.00',
      paymentOption: 'full',
      depositPaid: '349.00',
      promoApplied: true,
      promoDiscount: '219.00'
    };

    const finalData = { ...defaultData, ...bookingData, email: recipient };

    let html = '';
    let subject = '';
    
    switch (templateType) {
      case 'customer':
        html = generateBookingEmailHtml(finalData);
        subject = `🔥 [Torqued NZ Test] Booking Confirmed: Ref #${finalData.bookingId}`;
        break;
      case 'mechanic':
        html = generateMechanicEmailHtml(finalData);
        subject = `⚙️ [Torqued Hub Test] LIVE Workshop Dispatch: Ref #${finalData.bookingId}`;
        break;
      case 'dropoff':
        html = generateDropoffReminderEmailHtml(finalData);
        subject = `⏰ [Torqued NZ Test] Live Reminder: Drop-off in 12 Hours`;
        break;
      case 'service':
        html = generateServiceReminderEmailHtml(finalData);
        subject = `🔧 [Torqued Service Advisory Test] Scheduled DCT Calibration Reminder`;
        break;
      case 'otp': {
        const testCode = '123456';
        html = generateOtpEmailHtml(finalData.plate || 'RAH190', testCode);
        subject = `${testCode} is your Torqued verification code`;
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid templateType' });
    }

    const SMS = `TORQUED TEST: Booking Ref #${finalData.bookingId} is confirmed for vehicle (${finalData.vehicle} - ${finalData.plate}). Drop off time: ${finalData.time}!`;

    const transporter = getMailTransporter();
    let sentRealEmail = false;

    if (transporter) {
      try {
        const fromAddress = process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>';
        await transporter.sendMail({
          from: fromAddress,
          to: recipient,
          subject,
          html
        });
        sentRealEmail = true;
      } catch (smtpErr) {
        console.error('SMTP test direct dispatch failed, falling back to simulated output:', smtpErr);
        return res.json({
          success: true,
          sentRealEmail: false,
          smtpError: smtpErr instanceof Error ? smtpErr.message : 'SMTP Connection Refused/Auth Failure',
          recipient,
          templateType,
          html,
          smsText: SMS
        });
      }
    } else {
      console.log('\n--- [SIMULATED ELECTRONIC DISPATCH] ---');
      console.log(`To: ${recipient}`);
      console.log(`Subject: ${subject}`);
      console.log(`SMS: ${SMS}`);
      console.log('----------------------------------------\n');
    }

    res.json({
      success: true,
      sentRealEmail,
      recipient,
      templateType,
      html,
      smsText: SMS
    });
  } catch (err) {
    console.error('Test email sending failure:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
});


// Integrate Vite dynamic serving
// Export app for Vercel serverless — Vercel handles static files via CDN
export default app;

// Local dev only — start the HTTP server with Vite middleware
if (!process.env.VERCEL) {
  (async () => {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })();
}
