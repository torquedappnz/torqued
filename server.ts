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
// Stateless signed magic tokens (work across serverless instances — no shared memory)
const MAGIC_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_PASSWORD || 'torqued-magic-secret';
function makeMagicToken(rego: string): string {
  const payload = Buffer.from(JSON.stringify({ rego, exp: Date.now() + 15 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', MAGIC_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function readMagicToken(token: string): { rego: string } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expect = crypto.createHmac('sha256', MAGIC_SECRET).update(payload).digest('base64url');
    if (sig !== expect) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return { rego: data.rego };
  } catch { return null; }
}

function generateMagicEmailHtml(rego: string, link: string, appLink?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background:#0b0201 !important; }
    .card { background:#150402 !important; border-color:rgba(255,24,0,.2) !important; }
    .head { background:#050100 !important; }
    .title { color:#ffffff !important; }
    .muted { color:rgba(255,255,255,.6) !important; }
    .faint { color:rgba(255,255,255,.4) !important; }
  }
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" class="card" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td class="head" style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="display:inline-block;width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:40px 32px;text-align:center">
<span style="display:inline-block;background:rgba(255,24,0,.1);color:#FF1800;font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:6px">VEHICLE VERIFICATION</span>
<h1 class="title" style="margin:20px 0 8px;font-size:20px;font-weight:900;color:#150402;text-transform:uppercase">Confirm it's you</h1>
<p class="muted" style="margin:0 0 28px;font-size:13px;color:#555;line-height:1.5">Tap below to securely access the history for <strong style="color:#FF1800">${rego}</strong>.</p>
<a href="${link}" style="display:inline-block;background:#FF1800;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;text-decoration:none;padding:15px 36px;border-radius:12px">Verify &amp; Continue</a>
${appLink ? `<p style="margin:14px 0 0"><a href="${appLink}" style="display:inline-block;color:#FF1800;font-size:12px;font-weight:700;text-decoration:none">📱 Open in the Torqued app</a></p>` : ''}
<p class="faint" style="margin:28px 0 0;font-size:11px;color:#999;line-height:1.5">Link expires in 15 minutes. Or paste:<br/><a href="${link}" style="color:#999;word-break:break-all">${link}</a></p>
</td></tr>
<tr><td class="head" style="background:#150402;padding:18px 32px;text-align:center"><p style="margin:0;font-size:10px;color:rgba(255,255,255,.4)">Didn't request this? You can ignore this email.</p></td></tr>
</table></td></tr></table></body></html>`;
}

// Create a magic token, email the link, and return delivery info (+ fallback link if email fails)
async function sendMagicLink(rego: string, email: string, origin: string) {
  const token = makeMagicToken(rego);
  const link = `${origin}/customer?vt=${token}`;
  const appLink = `torqued://verify?vt=${token}`;   // opens the iOS app if installed
  let delivered = false;
  const transporter = getMailTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: `Verify your vehicle on Torqued`,
        html: generateMagicEmailHtml(rego, link, appLink),
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
      .select('id, name, address, labour_rate, technicians, parts_lead_days, rating, review_count, latitude, longitude')
      .eq('role', 'mechanic')
      .eq('subscription_active', true);
    res.json({ mechanics: data ?? [] });
  } catch (err) {
    console.error('[mechanics]', err);
    res.json({ mechanics: [] });
  }
});

// POST /api/mechanic/update-job-status — persist a job status change (service role)
app.post('/api/mechanic/update-job-status', async (req, res) => {
  try {
    const { bookingId, status } = req.body;
    const allowed = ['booked', 'in_progress', 'completed', 'declined', 'cancelled', 'pending', 'quoted'];
    if (!bookingId || !allowed.includes(status)) return res.status(400).json({ error: 'bookingId and a valid status are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const update: Record<string, any> = { status };
    if (status === 'completed') { update.completed_at = new Date().toISOString(); }
    const { error } = await supabase.from('bookings').update(update).eq('id', bookingId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/update-job-status]', err);
    res.status(500).json({ error: 'Could not update job' });
  }
});

// POST /api/bookings/persist — service-role booking upsert (used by $0/promo bookings that skip Stripe)
app.post('/api/bookings/persist', async (req, res) => {
  try {
    const { bookingData, userId } = req.body;
    if (!bookingData?.id) return res.status(400).json({ error: 'bookingData.id required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('bookings').upsert({
      id: bookingData.id,
      customer_id: userId || null,
      mechanic_id: bookingData.mechanicId,
      vehicle_rego: bookingData.vehicleId || null,
      service_ids: bookingData.serviceIds || [],
      status: bookingData.status || 'booked',
      payment_status: bookingData.paymentStatus || 'confirmed',
      payment_method: bookingData.paymentMethod || null,
      date: bookingData.date || null,
      total_price: bookingData.totalPrice || 0,
      deposit_paid: bookingData.depositPaid ?? null,
      customer_name: bookingData.customerName || null,
      email: bookingData.email || null,
      description: bookingData.description || null,
    }, { onConflict: 'id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[bookings/persist]', err);
    res.status(500).json({ error: 'Could not save booking' });
  }
});

// POST /api/vehicles/:rego/mileage — update system-wide odometer for a rego.
// phase: 'customer' (quoting screen) | 'in' (mechanic check-in) | 'out' (mechanic check-out)
app.post('/api/vehicles/:rego/mileage', async (req, res) => {
  try {
    const rego = req.params.rego.toUpperCase().trim();
    const { mileage, phase, bookingId } = req.body;
    const km = Number(mileage);
    if (!Number.isFinite(km) || km < 0) return res.status(400).json({ error: 'Valid mileage required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Always update the system-wide record for this rego
    const { error } = await supabase.from('vehicles').update({ mileage: km }).eq('rego', rego);
    if (error) return res.status(500).json({ error: error.message });

    // Record check-in / check-out odometer against the specific job
    if (bookingId && (phase === 'in' || phase === 'out')) {
      await supabase.from('bookings').update(phase === 'in' ? { mileage_in: km } : { mileage_out: km }).eq('id', bookingId);
    }
    res.json({ success: true, mileage: km });
  } catch (err) {
    console.error('[vehicles/mileage]', err);
    res.status(500).json({ error: 'Could not update mileage' });
  }
});

// GET /api/quote/:bookingId — full quote detail for the review-and-pay screen (QR deep-link target)
app.get('/api/quote/:bookingId', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: b } = await supabase.from('bookings').select('*').eq('id', req.params.bookingId).single();
    if (!b) return res.status(404).json({ error: 'Quote not found' });
    const ctx = await getBookingContext(b.id);
    res.json({
      id: b.id, rego: b.vehicle_rego, vehicleLabel: ctx.vehicleLabel, customerName: ctx.custName,
      mechanicName: ctx.mechanicName, serviceIds: b.service_ids || [],
      quotedPrice: b.quoted_price != null ? Number(b.quoted_price) : null,
      total: b.quoted_price != null ? Number(b.quoted_price) : (Number(b.total_price) || 0),
      note: b.quote_note || '', status: b.status, paymentStatus: b.payment_status, date: b.date,
    });
  } catch (err) {
    console.error('[quote]', err);
    res.status(500).json({ error: 'Could not load quote' });
  }
});

// GET /api/customer/bookings — all bookings for a customer (by ownerId and/or rego list). Single source of truth.
app.get('/api/customer/bookings', async (req, res) => {
  try {
    const ownerId = req.query.ownerId as string | undefined;
    const regos = (req.query.regos as string | undefined)?.split(',').map(r => r.toUpperCase().trim()).filter(Boolean);
    if (!ownerId && (!regos || regos.length === 0)) return res.json({ bookings: [] });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ bookings: [] });
    let q = supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (ownerId && regos && regos.length) q = q.or(`customer_id.eq.${ownerId},vehicle_rego.in.(${regos.join(',')})`);
    else if (ownerId) q = q.eq('customer_id', ownerId);
    else if (regos) q = q.in('vehicle_rego', regos);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ bookings: data ?? [] });
  } catch (err) {
    console.error('[customer/bookings]', err);
    res.json({ bookings: [] });
  }
});

// GET /api/history/:rego — combined, portable service history for a vehicle (follows the rego across mechanics)
app.get('/api/history/:rego', async (req, res) => {
  try {
    const rego = req.params.rego.toUpperCase().trim();
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ imported: [], jobs: [] });
    const [{ data: imported }, { data: jobs }] = await Promise.all([
      supabase.from('vehicle_history').select('*').eq('rego', rego).order('created_at', { ascending: false }),
      supabase.from('bookings').select('id, service_ids, status, payment_status, total_price, date, created_at, mechanic_id, completed_at')
        .eq('vehicle_rego', rego).order('created_at', { ascending: false }),
    ]);
    res.json({ imported: imported ?? [], jobs: jobs ?? [] });
  } catch (err) {
    console.error('[history]', err);
    res.json({ imported: [], jobs: [] });
  }
});

// GET /api/mechanic/customers?mechanicId= — customers who've interacted with this mechanic
// (cold-quoted, cold-added, or booked at least once). Deduped by email/phone.
app.get('/api/mechanic/customers', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ customers: [] });
    const { data } = await supabase.from('bookings')
      .select('customer_name, email, customer_phone, phone, vehicle_rego, created_at')
      .eq('mechanic_id', mechanicId).order('created_at', { ascending: false });
    const map = new Map<string, any>();
    (data ?? []).forEach((b: any) => {
      const key = (b.email || b.customer_phone || b.phone || b.customer_name || '').toLowerCase().trim();
      if (!key) return;
      const existing = map.get(key);
      const regos = new Set(existing?.regos || []); if (b.vehicle_rego) regos.add(b.vehicle_rego);
      map.set(key, {
        name: existing?.name || b.customer_name || '',
        email: existing?.email || b.email || '',
        phone: existing?.phone || b.customer_phone || b.phone || '',
        regos: [...regos],
        lastSeen: existing?.lastSeen || b.created_at,
      });
    });
    res.json({ customers: [...map.values()] });
  } catch (err) {
    console.error('[mechanic/customers]', err);
    res.json({ customers: [] });
  }
});

// GET /api/mechanic/jobs?mechanicId= — bookings for a mechanic (service role, bypasses RLS)
app.get('/api/mechanic/jobs', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ jobs: [] });
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('mechanic_id', mechanicId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ jobs: data ?? [] });
  } catch (err) {
    console.error('[mechanic/jobs]', err);
    res.json({ jobs: [] });
  }
});

// ── Passkeys (WebAuthn) ─────────────────────────────────────
const RP_ID = 'torqued-psi.vercel.app';
const RP_ORIGIN = 'https://torqued-psi.vercel.app';
const RP_NAME = 'Torqued';

// POST /api/passkey/register-options — begin passkey registration
app.post('/api/passkey/register-options', async (req, res) => {
  try {
    const { actorType, ownerRef } = req.body;
    if (!actorType || !ownerRef) return res.status(400).json({ error: 'actorType and ownerRef required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { generateRegistrationOptions } = await import('@simplewebauthn/server');

    const { data: existing } = await supabase.from('webauthn_credentials')
      .select('credential_id, transports').eq('actor_type', actorType).eq('owner_ref', String(ownerRef).toLowerCase());

    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userName: String(ownerRef), userID: new TextEncoder().encode(String(ownerRef).toLowerCase()),
      attestationType: 'none',
      excludeCredentials: (existing ?? []).map((c: any) => ({ id: c.credential_id, transports: c.transports || undefined })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    const challengeToken = signAdmin({ kind: 'pk-reg', actorType, ownerRef: String(ownerRef).toLowerCase(), challenge: options.challenge }, 5 * 60 * 1000);
    res.json({ options, challengeToken });
  } catch (err) {
    console.error('[passkey/register-options]', err);
    res.status(500).json({ error: 'Could not start registration' });
  }
});

// POST /api/passkey/register-verify — finish registration, store credential
app.post('/api/passkey/register-verify', async (req, res) => {
  try {
    const { challengeToken, response } = req.body;
    const data = challengeToken ? readSigned(challengeToken) : null;
    if (!data || data.kind !== 'pk-reg') return res.status(400).json({ error: 'Registration session expired.' });
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
    const verification = await verifyRegistrationResponse({
      response, expectedChallenge: data.challenge, expectedOrigin: RP_ORIGIN, expectedRPID: RP_ID,
    });
    if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: 'Verification failed' });
    const cred = verification.registrationInfo.credential;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    await supabase.from('webauthn_credentials').insert({
      actor_type: data.actorType, owner_ref: data.ownerRef,
      credential_id: cred.id,
      public_key: Buffer.from(cred.publicKey).toString('base64url'),
      counter: cred.counter || 0,
      transports: cred.transports || null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[passkey/register-verify]', err);
    res.status(500).json({ error: 'Could not save passkey' });
  }
});

// POST /api/passkey/auth-options — begin passkey authentication
app.post('/api/passkey/auth-options', async (req, res) => {
  try {
    const { actorType, ownerRef } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
    let allow: any[] | undefined;
    if (ownerRef) {
      const { data: creds } = await supabase.from('webauthn_credentials')
        .select('credential_id, transports').eq('actor_type', actorType).eq('owner_ref', String(ownerRef).toLowerCase());
      if (!creds || creds.length === 0) return res.status(404).json({ error: 'No passkey registered for this account.' });
      allow = creds.map((c: any) => ({ id: c.credential_id, transports: c.transports || undefined }));
    }
    const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'preferred', allowCredentials: allow });
    const challengeToken = signAdmin({ kind: 'pk-auth', actorType, ownerRef: ownerRef ? String(ownerRef).toLowerCase() : null, challenge: options.challenge }, 5 * 60 * 1000);
    res.json({ options, challengeToken });
  } catch (err) {
    console.error('[passkey/auth-options]', err);
    res.status(500).json({ error: 'Could not start sign-in' });
  }
});

// POST /api/passkey/auth-verify — finish authentication, return a session for the actor
app.post('/api/passkey/auth-verify', async (req, res) => {
  try {
    const { challengeToken, response } = req.body;
    const data = challengeToken ? readSigned(challengeToken) : null;
    if (!data || data.kind !== 'pk-auth') return res.status(400).json({ error: 'Sign-in session expired.' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: cred } = await supabase.from('webauthn_credentials').select('*').eq('credential_id', response.id).single();
    if (!cred) return res.status(404).json({ error: 'Passkey not recognised.' });

    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
    const verification = await verifyAuthenticationResponse({
      response, expectedChallenge: data.challenge, expectedOrigin: RP_ORIGIN, expectedRPID: RP_ID,
      credential: { id: cred.credential_id, publicKey: Buffer.from(cred.public_key, 'base64url'), counter: Number(cred.counter) || 0 },
    });
    if (!verification.verified) return res.status(400).json({ error: 'Verification failed' });
    await supabase.from('webauthn_credentials').update({ counter: verification.authenticationInfo.newCounter }).eq('id', cred.id);

    // Issue the right kind of session for the actor
    if (cred.actor_type === 'admin') {
      return res.json({ success: true, actorType: 'admin', key: signAdmin({ kind: 'admin-session', email: cred.owner_ref }, 12 * 60 * 60 * 1000) });
    }
    if (cred.actor_type === 'mechanic') {
      // Mint a Supabase session without password via a magiclink token_hash (client calls verifyOtp)
      const { data: link } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: cred.owner_ref });
      return res.json({ success: true, actorType: 'mechanic', email: cred.owner_ref, tokenHash: link?.properties?.hashed_token || null });
    }
    // customer: return rego + garage (no Supabase session needed)
    const rego = cred.owner_ref.toUpperCase();
    const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
    let email: string | null = null, ownerId: string | null = null, vehicles: any[] = [];
    if (vehicle?.owner_id) {
      ownerId = vehicle.owner_id;
      const { data: p } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
      email = p?.email ?? null;
      const { data: rows } = await supabase.from('vehicles').select('rego, make, model, year, variant, mileage, thumbnail').eq('owner_id', ownerId);
      vehicles = rows ?? [];
    }
    // vt: a short-lived signed token so the native app can complete sign-in after web passkey auth
    res.json({ success: true, actorType: 'customer', rego, email, ownerId, vehicles, vt: makeMagicToken(rego) });
  } catch (err) {
    console.error('[passkey/auth-verify]', err);
    res.status(500).json({ error: 'Sign-in failed' });
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

// POST /api/customer/manual-vehicle — create a vehicles row from manually-entered details
// when the customer's plate can't be found via the automated registry lookup.
// Returns same shape as check-plate so the frontend can continue to the OTP / register flow.
app.post('/api/customer/manual-vehicle', async (req, res) => {
  try {
    const { rego, year, make, model, submodel } = req.body;
    if (!rego || !make || !model) return res.status(400).json({ error: 'rego, make and model are required' });
    const formattedRego = String(rego).toUpperCase().trim();
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Check if already exists (idempotent)
    const { data: existing } = await supabase
      .from('vehicles').select('rego, owner_id').eq('rego', formattedRego).single();

    if (existing) {
      // Already in DB — route as normal check-plate result
      return res.json({ found: true, isNew: !existing.owner_id });
    }

    // Insert manually-entered vehicle
    const { error: insertErr } = await supabase.from('vehicles').insert({
      rego: formattedRego,
      year: year ? Number(year) : null,
      make: String(make).trim(),
      model: String(model).trim(),
      variant: submodel ? String(submodel).trim() : null,
    });
    if (insertErr) {
      console.error('[manual-vehicle] insert error:', insertErr);
      return res.status(500).json({ error: 'Could not register vehicle' });
    }

    return res.json({ found: true, isNew: true });
  } catch (err) {
    console.error('[manual-vehicle]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/customer/login-email — existing customer logs in by email; emails a magic link
app.post('/api/customer/login-email', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    // Find the customer + one of their vehicles (the magic token is keyed to a rego)
    const { data: profile } = await supabase.from('profiles').select('id, email').ilike('email', email).maybeSingle();
    if (!profile) return res.status(404).json({ error: "No Torqued account found for that email." });
    const { data: veh } = await supabase.from('vehicles').select('rego').eq('owner_id', profile.id).limit(1).maybeSingle();
    if (!veh?.rego) return res.status(404).json({ error: 'No vehicle linked to that account yet.' });
    const { delivered, fallbackLink } = await sendMagicLink(veh.rego, profile.email, getOrigin(req));
    res.json({ sent: true, maskedEmail: maskEmail(profile.email), ...(delivered ? {} : { fallbackLink }) });
  } catch (err) {
    console.error('[login-email]', err);
    res.status(500).json({ error: 'Could not send link' });
  }
});

// GET /api/customer/verify-link?token= — validate a magic link, return the customer's garage
app.get('/api/customer/verify-link', async (req, res) => {
  try {
    const token = req.query.token as string;
    const entry = token ? readMagicToken(token) : null;
    if (!entry) return res.status(400).json({ error: 'This link is invalid or has expired. Please request a new one.' });

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

// Hash a code with the shared secret (so the DB never stores the raw code)
function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(`${code}:${MAGIC_SECRET}`).digest('hex');
}

// POST /api/customer/send-code — iOS app: email a 6-digit code (by rego or email). Serverless-safe (DB-backed).
app.post('/api/customer/send-code', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    let rego = req.body.rego ? String(req.body.rego).toUpperCase().trim() : '';
    const emailIn = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    let ownerEmail: string | null = null;

    if (rego) {
      const { data: v } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
      if (v?.owner_id) {
        const { data: p } = await supabase.from('profiles').select('email').eq('id', v.owner_id).single();
        ownerEmail = p?.email ?? null;
      }
    } else if (emailIn) {
      const { data: p } = await supabase.from('profiles').select('id, email').ilike('email', emailIn).maybeSingle();
      if (p) {
        ownerEmail = p.email;
        const { data: veh } = await supabase.from('vehicles').select('rego').eq('owner_id', p.id).limit(1).maybeSingle();
        rego = veh?.rego ?? '';
      }
    }
    if (!rego || !ownerEmail) return res.status(404).json({ error: 'No Torqued account found for that detail.' });

    const code = crypto.randomInt(100000, 999999).toString();
    await supabase.from('customer_otps').upsert({
      rego, code_hash: hashOtp(code), email: ownerEmail,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), attempts: 0,
    }, { onConflict: 'rego' });

    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: ownerEmail, subject: `${code} is your Torqued verification code`,
        html: generateOtpEmailHtml(rego, code),
      }).catch(e => console.warn('OTP email failed:', e?.message));
    }
    res.json({ sent: true, rego, maskedEmail: maskEmail(ownerEmail) });
  } catch (err) {
    console.error('[send-code]', err);
    res.status(500).json({ error: 'Could not send code' });
  }
});

// POST /api/customer/verify-code — validate the 6-digit code, return the customer's garage
app.post('/api/customer/verify-code', async (req, res) => {
  try {
    const rego = String(req.body.rego || '').toUpperCase().trim();
    const code = String(req.body.code || '').trim();
    if (!rego || !code) return res.status(400).json({ error: 'rego and code are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: otp } = await supabase.from('customer_otps').select('*').eq('rego', rego).single();
    if (!otp) return res.status(400).json({ error: 'No code was sent for this plate. Request a new one.' });
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await supabase.from('customer_otps').delete().eq('rego', rego);
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    if ((otp.attempts ?? 0) >= 5) {
      await supabase.from('customer_otps').delete().eq('rego', rego);
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }
    if (otp.code_hash !== hashOtp(code)) {
      await supabase.from('customer_otps').update({ attempts: (otp.attempts ?? 0) + 1 }).eq('rego', rego);
      return res.status(401).json({ error: 'Incorrect code. Try again.' });
    }
    await supabase.from('customer_otps').delete().eq('rego', rego);

    const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
    let email: string | null = null, name: string | null = null, phone: string | null = null,
        ownerId: string | null = null, vehicles: any[] = [];
    if (vehicle?.owner_id) {
      ownerId = vehicle.owner_id;
      const { data: profile } = await supabase.from('profiles').select('email, name, phone').eq('id', ownerId).single();
      email = profile?.email ?? null; name = profile?.name ?? null; phone = profile?.phone ?? null;
      const { data: rows } = await supabase.from('vehicles')
        .select('rego, make, model, year, variant, mileage, thumbnail').eq('owner_id', ownerId);
      vehicles = rows ?? [];
    }
    res.json({ success: true, rego, email, name, phone, ownerId, vehicles });
  } catch (err) {
    console.error('[verify-code]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /applogin — lightweight web page the iOS app opens via ASWebAuthenticationSession.
// Runs the passkey ceremony in Safari (where iCloud Keychain passkeys work), then redirects
// to <cb>://verify?vt=… so the app completes sign-in. No AASA / paid entitlement needed.
app.get('/applogin', (req, res) => {
  const cb = (typeof req.query.cb === 'string' && /^[a-z0-9.-]+$/i.test(req.query.cb)) ? req.query.cb : 'torqued';
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Torqued</title>
<style>body{margin:0;font-family:-apple-system,Arial,sans-serif;background:#150402;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{max-width:340px;padding:28px;text-align:center}.logo{font-size:30px;font-weight:900;font-style:italic;color:#FF1800}
button{width:100%;background:#FF1800;color:#fff;border:0;border-radius:14px;padding:15px;font-size:16px;font-weight:800;margin-top:18px}
.m{color:rgba(255,255,255,.6);font-size:14px;margin-top:10px;min-height:20px}</style></head>
<body><div class="c"><div class="logo">TORQUED</div>
<p style="color:rgba(255,255,255,.7)">Sign in with your passkey to open your garage.</p>
<button id="go">Sign in with passkey</button>
<p class="m" id="msg"></p></div>
<script>
var cb=${JSON.stringify(cb)};
function msg(t){document.getElementById('msg').textContent=t;}
function b2b(s){s=s.replace(/-/g,'+').replace(/_/g,'/');var p='='.repeat((4-s.length%4)%4);var b=atob(s+p);var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a.buffer;}
function buf2b(buf){var b=new Uint8Array(buf),s='';for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}
async function go(){
  try{
    msg('Starting…');
    var o=await fetch('/api/passkey/auth-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actorType:'customer'})}).then(function(r){return r.json();});
    if(!o.options){msg(o.error||'Could not start.');return;}
    var opt=o.options;
    var pk={challenge:b2b(opt.challenge),rpId:opt.rpId,timeout:opt.timeout||60000,userVerification:opt.userVerification||'preferred',
      allowCredentials:(opt.allowCredentials||[]).map(function(c){return {type:'public-key',id:b2b(c.id),transports:c.transports};})};
    var cred=await navigator.credentials.get({publicKey:pk});
    var resp={id:cred.id,rawId:buf2b(cred.rawId),type:cred.type,clientExtensionResults:{},
      response:{clientDataJSON:buf2b(cred.response.clientDataJSON),authenticatorData:buf2b(cred.response.authenticatorData),
        signature:buf2b(cred.response.signature),userHandle:cred.response.userHandle?buf2b(cred.response.userHandle):null}};
    var v=await fetch('/api/passkey/auth-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeToken:o.challengeToken,response:resp})}).then(function(r){return r.json();});
    if(v.success&&v.vt){msg('Success! Returning to the app…');location.href=cb+'://verify?vt='+encodeURIComponent(v.vt);}
    else{msg(v.error||'Sign-in failed.');}
  }catch(e){msg('No passkey found or cancelled. Tap to try again.');}
}
document.getElementById('go').addEventListener('click',go);
go();
</script></body></html>`);
});

// GET /app-paid — iOS Stripe Checkout success page. Shows an acknowledgment and bounces
// back into the app via torqued://paid?booking=… (closes the ASWebAuthenticationSession sheet).
app.get('/app-paid', (req, res) => {
  const booking = typeof req.query.booking === 'string' ? req.query.booking.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment received · Torqued</title>
<style>body{margin:0;font-family:-apple-system,Arial,sans-serif;background:#150402;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{max-width:340px;padding:28px;text-align:center}.logo{font-size:30px;font-weight:900;font-style:italic;color:#FF1800}
.tick{font-size:64px;margin:10px 0}a{display:inline-block;margin-top:22px;background:#FF1800;color:#fff;text-decoration:none;border-radius:14px;padding:15px 22px;font-weight:800}
p{color:rgba(255,255,255,.75)}</style></head>
<body><div class="c"><div class="logo">TORQUED</div><div class="tick">✓</div>
<h2>Payment received</h2><p>Thanks! Your booking is confirmed. Returning you to My Garage…</p>
<a id="back" href="torqued://paid?booking=${booking}">Back to My Garage</a></div>
<script>setTimeout(function(){location.href='torqued://paid?booking=${booking}';},900);</script>
</body></html>`);
});

// GET /app-cancelled — iOS Stripe Checkout cancel page → returns to the app.
app.get('/app-cancelled', (req, res) => {
  const booking = typeof req.query.booking === 'string' ? req.query.booking.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment cancelled · Torqued</title>
<style>body{margin:0;font-family:-apple-system,Arial,sans-serif;background:#150402;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{max-width:340px;padding:28px;text-align:center}.logo{font-size:30px;font-weight:900;font-style:italic;color:#FF1800}
a{display:inline-block;margin-top:22px;background:rgba(255,255,255,.12);color:#fff;text-decoration:none;border-radius:14px;padding:15px 22px;font-weight:800}
p{color:rgba(255,255,255,.75)}</style></head>
<body><div class="c"><div class="logo">TORQUED</div><h2>Payment cancelled</h2>
<p>No charge was made. You can pay anytime from My Garage.</p>
<a id="back" href="torqued://cancelled?booking=${booking}">Back to My Garage</a></div>
<script>setTimeout(function(){location.href='torqued://cancelled?booking=${booking}';},700);</script>
</body></html>`);
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
        await supabase.from('vehicles').upsert({ rego: formattedRego, owner_id: existing.id }, { onConflict: 'rego' });
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

    // Link vehicle to this customer (create the row if this plate is brand-new)
    await supabase.from('vehicles').upsert({ rego: formattedRego, owner_id: userId }, { onConflict: 'rego' });

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

// Resolve customer name, car label ("VW Golf GTE (RAH190)") and mechanic name for a booking
async function getBookingContext(bookingId: string) {
  const ctx = { custName: '', email: '', rego: '', vehicleLabel: '', mechanicName: '', mechanicEmail: '' };
  const supabase = getSupabaseAdmin();
  if (!supabase || !bookingId) return ctx;
  const { data: b } = await supabase.from('bookings').select('email, customer_name, customer_id, vehicle_rego, mechanic_id').eq('id', bookingId).single();
  if (!b) return ctx;
  ctx.custName = b.customer_name || ''; ctx.email = b.email || ''; ctx.rego = b.vehicle_rego || '';
  if (b.vehicle_rego) {
    const { data: v } = await supabase.from('vehicles').select('make, model, owner_id').eq('rego', b.vehicle_rego).single();
    ctx.vehicleLabel = v?.make ? `${v.make} ${v.model} (${b.vehicle_rego})` : `(${b.vehicle_rego})`;
    // Backfill the customer's real name/email from their profile so emails address them by name (never "Dear Customer").
    if (!ctx.custName || !ctx.email) {
      const ownerId = b.customer_id || v?.owner_id;
      if (ownerId) {
        const { data: p } = await supabase.from('profiles').select('name, email').eq('id', ownerId).single();
        if (!ctx.custName) ctx.custName = p?.name || '';
        if (!ctx.email) ctx.email = p?.email || '';
      }
    }
  }
  if (b.mechanic_id) {
    const { data: m } = await supabase.from('profiles').select('name, email').eq('id', b.mechanic_id).single();
    ctx.mechanicName = m?.name || '';
    ctx.mechanicEmail = m?.email || '';
  }
  return ctx;
}

// Service id → display name (mirrors the app/website catalog) for emails built server-side.
const SERVICE_NAMES: Record<string, string> = {
  oil: 'Oil Change', wof: 'Warrant of Fitness', full: 'Full Service',
  brakes_front_pads: 'Front Brake Pads', brakes_front_rotors: 'Front Rotors & Pads',
  brakes_rear_pads: 'Rear Brake Pads', brakes_rear_rotors: 'Rear Rotors & Pads',
  timing: 'Cambelt & Waterpump', transmission: 'DCT Transmission Service',
  battery: 'Battery (12V)', diag_inspection: 'Diagnostic Inspection',
  spark_plugs: 'Spark Plugs', cabin_filter: 'Cabin Air Filter', brake_fluid: 'Brake Fluid Flush',
};

// Build the booking-confirmation emails from the ACTUAL persisted booking row (so an in-app/Stripe
// booking's email always matches what was booked) and dispatch them. Used by the Stripe webhook.
async function sendBookingConfirmationEmails(bookingId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { data: b } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!b || !b.email) { console.log('[booking-email] no booking/email for', bookingId); return; }

  // Resolve the customer's real name so the email greets them properly (never "Dear Customer").
  let custName = b.customer_name || '';
  if (!custName && (b.customer_id || b.vehicle_rego)) {
    let ownerId = b.customer_id;
    if (!ownerId && b.vehicle_rego) {
      const { data: v0 } = await supabase.from('vehicles').select('owner_id').eq('rego', b.vehicle_rego).single();
      ownerId = v0?.owner_id;
    }
    if (ownerId) {
      const { data: p } = await supabase.from('profiles').select('name').eq('id', ownerId).single();
      custName = p?.name || '';
    }
  }

  let vehicleLabel = `(${b.vehicle_rego})`;
  const plate = b.vehicle_rego || '';
  if (b.vehicle_rego) {
    const { data: v } = await supabase.from('vehicles').select('make, model, year').eq('rego', b.vehicle_rego).single();
    if (v?.make) vehicleLabel = `${v.year ? v.year + ' ' : ''}${v.make} ${v.model || ''}`.trim();
  }
  let mechanicName = '', mechanicAddress = '', mechanicEmail = '';
  if (b.mechanic_id) {
    const { data: m } = await supabase.from('profiles').select('name, address, email').eq('id', b.mechanic_id).single();
    mechanicName = m?.name || ''; mechanicAddress = m?.address || ''; mechanicEmail = m?.email || '';
  }
  const serviceNames: string[] = (b.service_ids || []).map((id: string) => SERVICE_NAMES[id] || id);
  if (serviceNames.length === 0 && b.description) serviceNames.push(b.description);

  const when = b.date ? new Date(b.date) : null;
  const dateStr = when && !isNaN(when.getTime())
    ? when.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : (b.date || '');
  const timeStr = when && !isNaN(when.getTime())
    ? when.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) : '';
  const price = b.quoted_price != null ? Number(b.quoted_price) : (Number(b.total_price) || 0);

  const data = {
    customerName: custName || 'there', bookingId: b.id, date: dateStr, time: timeStr,
    readyTime: '', vehicle: vehicleLabel, plate, mechanicName, mechanicAddress,
    paymentMethod: 'Card / Apple Pay', services: serviceNames, price: String(price),
    paymentOption: 'Paid in full', depositPaid: false, promoApplied: false, promoDiscount: '0',
  };

  const transporter = getMailTransporter();
  if (!transporter) { console.log('[booking-email] no SMTP transporter; skipped for', bookingId); return; }
  const fromAddress = process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>';
  try {
    await transporter.sendMail({
      from: fromAddress, to: b.email,
      subject: `Booking Confirmed: Ref #${b.id} (${vehicleLabel})`,
      html: generateBookingEmailHtml(data),
    });
    if (mechanicEmail) {
      await transporter.sendMail({
        from: fromAddress, to: mechanicEmail, replyTo: b.email,
        subject: `[New Torqued Booking] Ref #${b.id} - ${vehicleLabel} (${plate})`,
        html: generateMechanicEmailHtml(data),
      });
    }
    console.log(`[booking-email] confirmation sent for ${b.id} → ${b.email}`);
  } catch (e) {
    console.error('[booking-email] dispatch failed:', (e as Error).message);
  }
}

// Insert an in-app notification (resolves owner/rego from the booking when needed).
async function notify(opts: { bookingId?: string; rego?: string; ownerId?: string | null; type: string; title: string; body?: string }) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    let rego = opts.rego, ownerId = opts.ownerId ?? null;
    if (opts.bookingId && (!rego || !ownerId)) {
      const { data: b } = await supabase.from('bookings').select('vehicle_rego, customer_id').eq('id', opts.bookingId).single();
      rego = rego || b?.vehicle_rego || undefined;
      ownerId = ownerId || b?.customer_id || null;
    }
    if (!ownerId && rego) {
      const { data: v } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
      ownerId = v?.owner_id ?? null;
    }
    await supabase.from('notifications').insert({
      owner_id: ownerId, rego: rego || null, type: opts.type,
      title: opts.title, body: opts.body || null, booking_id: opts.bookingId || null,
    });
  } catch (e) { console.warn('[notify]', (e as Error).message); }
}

// GET /api/customer/notifications — feed for a customer (by owner and/or rego list)
app.get('/api/customer/notifications', async (req, res) => {
  try {
    const ownerId = req.query.ownerId as string | undefined;
    const regos = (req.query.regos as string | undefined)?.split(',').map(r => r.toUpperCase().trim()).filter(Boolean);
    const supabase = getSupabaseAdmin();
    if (!supabase || (!ownerId && !(regos && regos.length))) return res.json({ notifications: [] });
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (ownerId && regos && regos.length) q = q.or(`owner_id.eq.${ownerId},rego.in.(${regos.join(',')})`);
    else if (ownerId) q = q.eq('owner_id', ownerId);
    else if (regos) q = q.in('rego', regos);
    const { data } = await q;
    res.json({ notifications: data ?? [] });
  } catch (err) {
    console.error('[notifications]', err);
    res.json({ notifications: [] });
  }
});

// POST /api/customer/notifications/read — mark one (or all for an owner) read
app.post('/api/customer/notifications/read', async (req, res) => {
  try {
    const { id, ownerId } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    if (id) await supabase.from('notifications').update({ read: true }).eq('id', id);
    else if (ownerId) await supabase.from('notifications').update({ read: true }).eq('owner_id', ownerId);
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications/read]', err);
    res.status(500).json({ error: 'Could not update' });
  }
});

// POST /api/customer/reply — customer replies to a mechanic message (emails the mechanic)
app.post('/api/customer/reply', async (req, res) => {
  try {
    const { bookingId, message } = req.body;
    if (!bookingId || !message?.trim()) return res.status(400).json({ error: 'bookingId and message required' });
    const ctx = await getBookingContext(bookingId);
    if (!ctx.mechanicEmail) return res.status(400).json({ error: 'No mechanic email on this job.' });
    const transporter = getMailTransporter();
    if (transporter) {
      const safe = String(message).replace(/</g, '&lt;').replace(/\n/g, '<br/>');
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        replyTo: ctx.email || undefined,
        to: ctx.mechanicEmail,
        subject: `Reply from ${ctx.custName || 'your customer'} · ${ctx.vehicleLabel || ''}`,
        html: `<div style="font-family:-apple-system,Arial,sans-serif"><p>${ctx.custName || 'The customer'} replied regarding ${ctx.vehicleLabel || 'their vehicle'}:</p><blockquote style="border-left:3px solid #FF1800;padding-left:12px;color:#333">${safe}</blockquote></div>`,
      }).catch(e => console.warn('reply email failed:', e?.message));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[customer/reply]', err);
    res.status(500).json({ error: 'Could not send reply' });
  }
});

// "Your quote is ready" email — exact approved copy, NO dollar amount (amounts live online + in the PDF only)
function quoteReadyEmailHtml(custName: string, vehicleLabel: string, mechanicName: string, bookingId: string): string {
  const car = vehicleLabel || 'your vehicle';
  const mech = mechanicName ? ` from ${mechanicName}` : '';
  const link = `https://torquednz.vercel.app/customer?quote=${encodeURIComponent(bookingId)}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:36px 32px;color:#150402;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">Dear ${custName ? custName.split(' ')[0] : 'there'},</p>
<p style="margin:0 0 16px">Thanks for booking with Torqued. Your quote for your ${car}${mech} is ready.</p>
<p style="margin:0 0 24px">We have a wide range of flexible payment options to suit your budget.</p>
<a href="${link}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px">View your quote</a>
<p style="margin:28px 0 0;color:#555">Kind regards,<br/>the Torqued team</p>
</td></tr></table></td></tr></table></body></html>`;
}

// POST /api/mechanic/cold-quote — mechanic creates a booking for a NON-Torqued customer (CRM).
// Returns a bookingId; the normal quote builder + send-quote-pdf then finishes & emails it.
app.post('/api/mechanic/cold-quote', async (req, res) => {
  try {
    const { mechanicId, customerName, email, phone, rego, make, model, description, date } = req.body;
    if (!mechanicId || !email || !customerName) return res.status(400).json({ error: 'mechanicId, customer name and email are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const plate = rego ? String(rego).toUpperCase().trim() : null;

    // Track the vehicle so history follows the rego (best-effort)
    if (plate) {
      await supabase.from('vehicles').upsert({ rego: plate, make: make || 'Unknown', model: model || 'Vehicle' }, { onConflict: 'rego', ignoreDuplicates: true });
      if (make || model) await supabase.from('vehicles').update({ ...(make ? { make } : {}), ...(model ? { model } : {}) }).eq('rego', plate);
    }

    const bookingId = 'CQ' + Date.now().toString(36).toUpperCase();
    const { error } = await supabase.from('bookings').insert({
      id: bookingId, mechanic_id: mechanicId, vehicle_rego: plate,
      customer_name: customerName, email, customer_phone: phone || null,
      service_ids: [], status: 'booked', payment_status: 'pending',
      date: date || null,
      description: description || null, is_cold_quote: true, total_price: 0,
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, bookingId });
  } catch (err) {
    console.error('[cold-quote]', err);
    res.status(500).json({ error: 'Could not create cold quote' });
  }
});

// POST /api/mechanic/message-customer — mechanic sends a real email to the customer
app.post('/api/mechanic/message-customer', async (req, res) => {
  try {
    const { bookingId, message } = req.body;
    if (!bookingId || !message?.trim()) return res.status(400).json({ error: 'bookingId and message required' });
    const ctx = await getBookingContext(bookingId);
    if (!ctx.email) return res.status(400).json({ error: 'No customer email on this booking.' });
    const transporter = getMailTransporter();
    if (!transporter) return res.status(503).json({ error: 'Email not configured' });
    const car = ctx.vehicleLabel || 'your vehicle';
    const safeMsg = String(message).replace(/</g, '&lt;').replace(/\n/g, '<br/>');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:36px 32px;color:#150402;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">Dear ${ctx.custName ? ctx.custName.split(' ')[0] : 'there'},</p>
<p style="margin:0 0 8px;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:bold">Message from ${ctx.mechanicName || 'your workshop'} regarding ${car}</p>
<div style="margin:0 0 20px;padding:16px;background:#f7f7f9;border-radius:12px;border-left:3px solid #FF1800">${safeMsg}</div>
<p style="margin:0;color:#555">Reply to this email to respond directly.</p>
<p style="margin:24px 0 0;color:#555">Kind regards,<br/>${ctx.mechanicName || 'Your workshop'} via Torqued</p>
</td></tr></table></td></tr></table></body></html>`;
    // Reply routes to the mechanic if they have an email on file; otherwise a no-reply address
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
      replyTo: ctx.mechanicEmail || 'do-not-reply@torqued.nz',
      to: ctx.email,
      subject: `Message about your ${ctx.vehicleLabel || 'vehicle'} — Torqued`,
      html,
    });
    await notify({ bookingId, type: 'message', title: `Message from ${ctx.mechanicName || 'your workshop'}`, body: message });
    res.json({ success: true });
  } catch (err) {
    console.error('[message-customer]', err);
    res.status(500).json({ error: 'Could not send message' });
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

    // Email the customer their quote — by name + car, NO amount in the email
    const ctx = await getBookingContext(bookingId);
    const transporter = getMailTransporter();
    if (ctx.email && transporter && quotedPrice != null) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: ctx.email,
        subject: `Your Torqued quote for your ${ctx.vehicleLabel || 'vehicle'} is ready`,
        html: quoteReadyEmailHtml(ctx.custName, ctx.vehicleLabel, ctx.mechanicName, bookingId),
      }).catch(()=>{});
    }
    if (quotedPrice != null) await notify({ bookingId, type: 'quote_ready', title: 'Your quote is ready',
      body: `Your quote for your ${ctx.vehicleLabel || 'vehicle'} is ready to review and pay.` });
    res.json({ success: true });
  } catch (err) {
    console.error('[update-quote]', err);
    res.status(500).json({ error: 'Could not update quote' });
  }
});

// POST /api/mechanic/send-quote-pdf — email a generated quote PDF to the customer
app.post('/api/mechanic/send-quote-pdf', async (req, res) => {
  try {
    const { bookingId, total, note, pdfBase64, items } = req.body;
    let { email } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' });
    const supabase = getSupabaseAdmin();
    if (supabase && bookingId) {
      await supabase.from('bookings').update({
        quoted_price: total != null ? Number(total) : null,
        quote_note: note || null,
        quote_items: items ?? null,   // structured breakdown so the editor can be re-opened
      }).eq('id', bookingId);
    }
    const ctx = await getBookingContext(bookingId);
    if (!email) email = ctx.email;
    if (!email) return res.status(400).json({ error: 'No customer email on this booking.' });
    const transporter = getMailTransporter();
    if (!transporter) return res.status(503).json({ error: 'Email not configured' });

    // Approved copy, addressed by name + car, NO amount in the email (amounts in the attached PDF + online)
    const html = quoteReadyEmailHtml(ctx.custName, ctx.vehicleLabel, ctx.mechanicName, bookingId || '');

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
      to: email,
      subject: `Your Torqued quote for your ${ctx.vehicleLabel || 'vehicle'} is ready`,
      html,
      attachments: [{ filename: `Torqued-Quote-${bookingId || 'TQ'}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }],
    });
    await notify({ bookingId, type: 'quote_ready', title: 'Your quote is ready',
      body: `Your quote for your ${ctx.vehicleLabel || 'vehicle'}${ctx.mechanicName ? ` from ${ctx.mechanicName}` : ''} is ready to review and pay.` });
    res.json({ success: true });
  } catch (err) {
    console.error('[send-quote-pdf]', err);
    res.status(500).json({ error: 'Could not send quote' });
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

// ── Service packages (per mechanic) ─────────────────────────
app.get('/api/mechanic/packages', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    const supabase = getSupabaseAdmin();
    if (!supabase || !mechanicId) return res.json({ packages: [] });
    const { data } = await supabase.from('service_packages')
      .select('id, name, description, price, duration_min, pkg_type, included_items, base_fee, oil_grade, oil_litres, oil_cost_per_l, filter_cost, trans_oil_litres, trans_oil_cost_per_l, freight, scan_tool_fee')
      .eq('mechanic_id', mechanicId).order('price');
    res.json({ packages: data ?? [] });
  } catch { res.json({ packages: [] }); }
});

app.post('/api/mechanic/packages', async (req, res) => {
  try {
    const { mechanicId, name, description, price, durationMin, pkgType, includedItems,
      baseFee, oilGrade, oilLitres, oilCostPerL, filterCost,
      transOilLitres, transOilCostPerL, freight, scanToolFee } = req.body;
    if (!mechanicId || !name || price == null) return res.status(400).json({ error: 'mechanicId, name, price required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const n = (v: any) => (v != null && v !== '' ? Number(v) : null);
    const { data, error } = await supabase.from('service_packages').insert({
      mechanic_id: mechanicId, name, description: description || null,
      price: Number(price), duration_min: durationMin ? Number(durationMin) : 60,
      pkg_type: pkgType || 'standard',
      included_items: Array.isArray(includedItems) && includedItems.length ? includedItems : null,
      base_fee: n(baseFee), oil_grade: oilGrade || null, oil_litres: n(oilLitres),
      oil_cost_per_l: n(oilCostPerL), filter_cost: n(filterCost),
      trans_oil_litres: n(transOilLitres), trans_oil_cost_per_l: n(transOilCostPerL),
      freight: n(freight), scan_tool_fee: n(scanToolFee),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, package: data });
  } catch (err) {
    console.error('[packages create]', err);
    res.status(500).json({ error: 'Could not create package' });
  }
});

app.post('/api/mechanic/packages/delete', async (req, res) => {
  try {
    const { id, mechanicId } = req.body;
    if (!id || !mechanicId) return res.status(400).json({ error: 'id and mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    await supabase.from('service_packages').delete().eq('id', id).eq('mechanic_id', mechanicId);
    res.json({ success: true });
  } catch (err) {
    console.error('[packages delete]', err);
    res.status(500).json({ error: 'Could not delete package' });
  }
});

// POST /api/mechanic/car-ready — mechanic checks out: save odometer, add note, notify customer their car is ready
app.post('/api/mechanic/car-ready', async (req, res) => {
  try {
    const { bookingId, km, notes, mechanicName } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });

    const ctx = await getBookingContext(bookingId);
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Save odometer + mark completed
    const updatePayload: any = { status: 'completed', completed_at: new Date().toISOString() };
    if (km && Number.isFinite(Number(km))) {
      updatePayload.mileage_out = Number(km);
      try { await supabase.from('vehicles').update({ mileage: Number(km), mileage_date: new Date().toISOString() }).eq('rego', booking.vehicle_rego); } catch {}
    }
    await supabase.from('bookings').update(updatePayload).eq('id', bookingId);

    // Save mechanic note with timestamp
    if (notes?.trim()) {
      try { await supabase.from('booking_notes').insert({ booking_id: bookingId, note: notes.trim(), author: mechanicName || 'mechanic' }); } catch {}
    }

    // In-app notification: car ready
    const vLabel = ctx.vehicleLabel || `(${booking.vehicle_rego})`;
    const mechDisplayName = ctx.mechanicName || mechanicName || 'your workshop';
    await notify({
      bookingId, rego: booking.vehicle_rego, ownerId: booking.customer_id,
      type: 'car_ready',
      title: `Your ${vLabel} is ready for collection`,
      body: `${mechDisplayName} has finished work on your vehicle. Head in to collect it at your convenience.${notes?.trim() ? ` Note from mechanic: ${notes.trim()}` : ''}`,
    });

    // Email: car ready
    const to = booking.email || ctx.email;
    const transporter = getMailTransporter();
    const custFirst = (ctx.custName || 'there').split(' ')[0];
    if (to && transporter) {
      const notesHtml = notes?.trim()
        ? `<div style="margin-top:16px;background:#f7f7f9;border-left:3px solid #FF1800;padding:12px 16px;border-radius:0 8px 8px 0"><p style="margin:0;font-size:13px;color:#555;font-style:italic">"${notes.trim()}"</p><p style="margin:4px 0 0;font-size:11px;color:#999">— ${mechDisplayName}</p></div>` : '';
      const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
<div style="background:#150402;padding:24px;text-align:center"><img src="${LOGO_URL}" width="180" style="height:auto"/></div>
<div style="padding:32px;color:#150402">
<span style="display:inline-block;background:rgba(255,24,0,0.08);color:#FF1800;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 10px;border-radius:6px;margin-bottom:12px">JOB COMPLETE</span>
<h2 style="margin:0 0 8px;font-size:22px">Your car is ready, ${custFirst}! 🎉</h2>
<p style="color:#555;font-size:14px;line-height:1.6">Your <strong>${vLabel}</strong> has been serviced by <strong>${mechDisplayName}</strong> and is ready for collection.</p>
${notesHtml}
<p style="color:#555;font-size:13px;margin-top:16px">Head in at your convenience to pick it up. If you have any questions, reply to this email.</p>
<a href="${getOrigin(req)}/customer?review_booking=${bookingId}&m=${booking.mechanic_id}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:1px;text-decoration:none;padding:14px 28px;border-radius:10px;margin-top:20px">Rate your experience →</a>
</div></div>`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to, subject: `Your ${vLabel} is ready for collection`,
        html,
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[mechanic/car-ready]', err);
    res.status(500).json({ error: err?.message || 'Failed' });
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
    const ctx = await getBookingContext(bookingId);
    const mechName = ctx.mechanicName || 'your workshop';
    const vehicleLabel = ctx.vehicleLabel || `(${booking.vehicle_rego})`;
    const to = booking.email || ctx.email;
    const transporter = getMailTransporter();
    if (to && transporter) {
      const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
<div style="background:#150402;padding:24px;text-align:center"><img src="${LOGO_URL}" width="180" style="height:auto"/></div>
<div style="padding:32px;color:#150402">
<h2 style="margin:0 0 8px">Rate your experience with ${mechName}</h2>
<p style="color:#555;font-size:14px">Thanks for booking in your <strong>${vehicleLabel}</strong> with Torqued. Please leave a review to help others find a mechanic near them.</p>
<a href="${reviewUrl}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:12px">Leave a Review</a>
</div></div>`;
      await transporter.sendMail({ from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>', to, subject: `Rate your experience with ${mechName}`, html }).catch(()=>{});
    }
    await notify({ bookingId, rego: booking.vehicle_rego, ownerId: booking.customer_id, type: 'review_reminder',
      title: `Rate your experience with ${mechName}`,
      body: `Thanks for booking in your ${vehicleLabel} with Torqued. Please leave a review to help others find a mechanic near them.` });
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
  if (!key) return false;
  // Accept the master env password OR a valid signed admin session token
  return key === (process.env.ADMIN_PASSWORD || 'torqued-admin-2026') || !!readAdminSession(key);
}

// ── Admin auth helpers (pbkdf2 hashing + signed session/setup tokens) ──
function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
}
function signAdmin(payload: object, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', MAGIC_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function readSigned(token: string): any | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    if (sig !== crypto.createHmac('sha256', MAGIC_SECRET).update(body).digest('base64url')) return null;
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}
function readAdminSession(token: string): any | null {
  const d = readSigned(token);
  return d && d.kind === 'admin-session' ? d : null;
}

// POST /api/admin/request-setup — email an admin a "set your password" link (master key gated)
app.post('/api/admin/request-setup', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    await supabase.from('admin_users').upsert({ email }, { onConflict: 'email' });

    const token = signAdmin({ kind: 'admin-setup', email }, 24 * 60 * 60 * 1000);
    const link = `https://torquednz.vercel.app/admin?setup=${token}`;
    const transporter = getMailTransporter();
    if (transporter) {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:36px 32px;color:#150402">
<span style="display:inline-block;background:rgba(255,24,0,.1);color:#FF1800;font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:6px">ADMIN ACCESS</span>
<h1 style="margin:18px 0 6px;font-size:22px;font-weight:900;text-transform:uppercase">Create your admin password</h1>
<p style="margin:0 0 22px;font-size:14px;color:#555;line-height:1.5">You've been granted admin access to the Torqued back-office. Set your own secure password using the button below — it's never shared.</p>
<a href="${link}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px">Create Password</a>
<p style="margin:22px 0 0;font-size:11px;color:#999;line-height:1.5">Link expires in 24 hours. Or paste:<br/><a href="${link}" style="color:#999;word-break:break-all">${link}</a></p>
</td></tr></table></td></tr></table></body></html>`;
      await transporter.sendMail({ from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>', to: email, subject: 'Set your Torqued admin password', html });
    }
    res.json({ sent: true });
  } catch (err) {
    console.error('[admin/request-setup]', err);
    res.status(500).json({ error: 'Failed to send setup link' });
  }
});

// POST /api/admin/set-password — admin sets their password via the setup token
app.post('/api/admin/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const data = token ? readSigned(token) : null;
    if (!data || data.kind !== 'admin-setup') return res.status(400).json({ error: 'This setup link is invalid or expired.' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('admin_users')
      .update({ password_hash: hashPassword(password), password_set_at: new Date().toISOString() })
      .eq('email', data.email);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, email: data.email });
  } catch (err) {
    console.error('[admin/set-password]', err);
    res.status(500).json({ error: 'Could not set password' });
  }
});

// POST /api/admin/login — email + password -> signed admin session token
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: admin } = await supabase.from('admin_users').select('email, password_hash').eq('email', email).single();
    if (!admin || !admin.password_hash) return res.status(401).json({ error: 'No admin account or password not set yet.' });
    if (!verifyPassword(password, admin.password_hash)) return res.status(401).json({ error: 'Incorrect password.' });
    const sessionKey = signAdmin({ kind: 'admin-session', email }, 12 * 60 * 60 * 1000);
    res.json({ success: true, key: sessionKey });
  } catch (err) {
    console.error('[admin/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

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

// POST /api/admin/send-login — email admin access details + ask them to set a password
app.post('/api/admin/send-login', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const transporter = getMailTransporter();
    if (!transporter) return res.status(503).json({ error: 'Email not configured' });

    const tempPass = process.env.ADMIN_PASSWORD || 'torqued-admin-2026';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:36px 32px;color:#150402">
<span style="display:inline-block;background:rgba(255,24,0,.1);color:#FF1800;font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:6px">ADMIN ACCESS</span>
<h1 style="margin:18px 0 6px;font-size:22px;font-weight:900;text-transform:uppercase">Back-Office Login</h1>
<p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.5">You've been granted admin access to the Torqued back-office.</p>
<div style="background:#f7f7f9;border:1px solid #e6e6ea;border-radius:12px;padding:16px;font-size:14px">
<p style="margin:0 0 8px"><strong>Portal:</strong> <a href="https://torquednz.vercel.app/admin" style="color:#FF1800">torquednz.vercel.app/admin</a></p>
<p style="margin:0"><strong>Temporary password:</strong> <span style="font-family:monospace">${tempPass}</span></p>
</div>
<div style="background:#fff7e6;border:1px solid #ffe2a8;border-radius:12px;padding:16px;margin-top:16px">
<p style="margin:0;font-size:13px;color:#7a5b00"><strong>Action required:</strong> for security, please generate a strong password of your own and reply with it (or send it to the team) so we can set it on your admin account. Don't keep the temporary password.</p>
</div>
<a href="https://torquednz.vercel.app/admin" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:18px">Open Admin Portal</a>
</td></tr></table></td></tr></table></body></html>`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
      to: email,
      subject: 'Your Torqued admin access — set your password',
      html,
    });
    res.json({ sent: true });
  } catch (err) {
    console.error('[admin/send-login]', err);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// GET /api/admin/search?q= — search bookings, customers, mechanics
app.get('/api/admin/search', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const q = ((req.query.q as string) || '').trim();
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ bookings: [], people: [] });
    if (!q) return res.json({ bookings: [], people: [] });
    const like = `%${q}%`;

    const { data: bookings } = await supabase.from('bookings')
      .select('id, vehicle_rego, mechanic_id, customer_name, email, total_price, quoted_price, status, payment_status, refunded_amount, date, created_at')
      .or(`id.ilike.${like},vehicle_rego.ilike.${like},email.ilike.${like},customer_name.ilike.${like}`)
      .order('created_at', { ascending: false }).limit(40);

    const { data: people } = await supabase.from('profiles')
      .select('id, name, email, role, phone, subscription_active, rating')
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(40);

    // Vehicles matched by rego or owner, with their full service history (portable across mechanics)
    const ownerIds = (people ?? []).map((p: any) => p.id);
    let vehQ = supabase.from('vehicles').select('rego, make, model, year, variant, mileage, owner_id');
    vehQ = ownerIds.length
      ? vehQ.or(`rego.ilike.${like},owner_id.in.(${ownerIds.join(',')})`)
      : vehQ.ilike('rego', like);
    const { data: vehicles } = await vehQ.limit(40);
    const regos = (vehicles ?? []).map((v: any) => v.rego);
    let history: any[] = [];
    if (regos.length) {
      const { data: h } = await supabase.from('vehicle_history').select('*').in('rego', regos).order('created_at', { ascending: false });
      history = h ?? [];
    }

    res.json({ bookings: bookings ?? [], people: people ?? [], vehicles: vehicles ?? [], history });
  } catch (err) {
    console.error('[admin/search]', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/admin/update-booking — edit any booking field (whitelisted)
app.post('/api/admin/update-booking', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { id, fields } = req.body;
    if (!id || !fields) return res.status(400).json({ error: 'id and fields required' });
    const allowed = ['status','payment_status','total_price','quoted_price','date','customer_name','email','phone','vehicle_rego','mechanic_id'];
    const update: Record<string, any> = {};
    for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('bookings').update(update).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/update-booking]', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// POST /api/admin/update-profile — edit any customer/mechanic profile (whitelisted)
app.post('/api/admin/update-profile', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { id, fields } = req.body;
    if (!id || !fields) return res.status(400).json({ error: 'id and fields required' });
    const allowed = ['name','email','phone','role','subscription_active','address','nzbn','labour_rate','technicians','parts_lead_days'];
    const update: Record<string, any> = {};
    for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('profiles').update(update).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/update-profile]', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

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

// GET /api/admin/booking/:id — full booking context for the admin (mechanic, customer, vehicle, history)
app.get('/api/admin/booking/:id', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: b } = await supabase.from('bookings').select('*').eq('id', req.params.id).single();
    if (!b) return res.status(404).json({ error: 'Booking not found' });

    let mechanic = null, vehicle = null, history: any[] = [], torquedJobs: any[] = [];
    if (b.mechanic_id) {
      const { data: m } = await supabase.from('profiles').select('name, email, phone, address').eq('id', b.mechanic_id).single();
      mechanic = m;
    }
    if (b.vehicle_rego) {
      const { data: v } = await supabase.from('vehicles').select('*').eq('rego', b.vehicle_rego).single();
      vehicle = v;
      const { data: h } = await supabase.from('vehicle_history').select('*').eq('rego', b.vehicle_rego).order('created_at', { ascending: false });
      history = h ?? [];
      const { data: tj } = await supabase.from('bookings').select('id, service_ids, status, payment_status, total_price, quoted_price, date, created_at')
        .eq('vehicle_rego', b.vehicle_rego).neq('id', b.id).order('created_at', { ascending: false });
      torquedJobs = tj ?? [];
    }
    res.json({ booking: b, mechanic, vehicle, history, torquedJobs });
  } catch (err) {
    console.error('[admin/booking]', err);
    res.status(500).json({ error: 'Could not load booking' });
  }
});

// GET /api/admin/mechanic/:id — full mechanic profile, their jobs, revenue & subscription
app.get('/api/admin/mechanic/:id', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const id = req.params.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (!profile) return res.status(404).json({ error: 'Mechanic not found' });
    const { data: jobs } = await supabase.from('bookings').select('*').eq('mechanic_id', id).order('created_at', { ascending: false });
    const all = jobs ?? [];
    const paid = all.filter((j: any) => j.payment_status === 'confirmed');
    const gross = paid.reduce((s: number, j: any) => s + (parseFloat(j.total_price) || 0), 0);
    const refunded = all.reduce((s: number, j: any) => s + (parseFloat(j.refunded_amount) || 0), 0);
    const revenue = { jobs: all.length, paid: paid.length, gross: Math.round(gross * 100) / 100, commission: Math.round(gross * 4) / 100, payout: Math.round(gross * 96) / 100, refunded: Math.round(refunded * 100) / 100 };

    // Subscription + Stripe invoices
    let billing: any = { active: !!profile.subscription_active, status: profile.subscription_active ? 'active' : 'inactive', invoices: [] };
    const stripe = getStripe();
    if (stripe && profile.stripe_subscription_id) {
      try {
        const sub: any = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        billing.status = sub.status; billing.nextBilling = sub.current_period_end ? sub.current_period_end * 1000 : null;
        const list = await stripe.invoices.list({ customer: sub.customer as string, limit: 12 });
        billing.invoices = list.data.map((inv: any) => ({ id: inv.id, date: inv.created * 1000, amount: (inv.amount_paid || inv.amount_due || 0) / 100, status: inv.status, url: inv.hosted_invoice_url || inv.invoice_pdf || null }));
      } catch {}
    }
    res.json({ profile, jobs: all, revenue, billing });
  } catch (err) {
    console.error('[admin/mechanic]', err);
    res.status(500).json({ error: 'Could not load mechanic' });
  }
});

// POST /api/admin/reset-password — email a password reset to any user (mechanic/customer/admin)
app.post('/api/admin/reset-password', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { userId, email: emailIn } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    let email = emailIn;
    if (!email && userId) {
      const { data: p } = await supabase.from('profiles').select('email').eq('id', userId).single();
      email = p?.email;
    }
    if (!email) return res.status(400).json({ error: 'No email for this user' });
    const origin = getOrigin(req);
    const { data: link } = await supabase.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo: `${origin}/mechanic` },
    });
    const resetLink = link?.properties?.action_link;
    if (!resetLink) return res.status(500).json({ error: 'Could not generate reset link' });
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: 'Reset your Torqued password',
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:36px 32px;color:#150402;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">A password reset was requested for your Torqued account.</p>
<p style="margin:0 0 20px"><a href="${resetLink}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px">Reset password</a></p>
<p style="margin:0;color:#555">If you didn't request this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`,
      }).catch(e => console.warn('Reset email failed (non-blocking):', e?.message));
    }
    res.json({ success: true, resetLink });
  } catch (err) {
    console.error('[admin/reset-password]', err);
    res.status(500).json({ error: 'Could not send reset' });
  }
});

// GET /api/admin/weekly-report — prior Mon–Sun revenue per mechanic (jobs − 4%)
app.get('/api/admin/weekly-report', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ rows: [] });
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const thisMon = new Date(now); thisMon.setHours(0, 0, 0, 0); thisMon.setDate(now.getDate() - dow);
    const start = new Date(thisMon); start.setDate(thisMon.getDate() - 7);
    const end = new Date(thisMon); end.setMilliseconds(-1);

    const { data: bookings } = await supabase.from('bookings')
      .select('mechanic_id, total_price, payment_status, created_at, completed_at')
      .eq('payment_status', 'confirmed')
      .gte('created_at', start.toISOString());
    const inRange = (bookings ?? []).filter((b: any) => {
      const t = new Date(b.completed_at || b.created_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const { data: mechs } = await supabase.from('profiles').select('id, name').eq('role', 'mechanic');
    const nameOf = (id: string) => (mechs ?? []).find((m: any) => m.id === id)?.name || id;

    const byMech: Record<string, { gross: number; jobs: number }> = {};
    inRange.forEach((b: any) => {
      const k = b.mechanic_id || 'unassigned';
      byMech[k] = byMech[k] || { gross: 0, jobs: 0 };
      byMech[k].gross += parseFloat(b.total_price) || 0; byMech[k].jobs += 1;
    });
    const rows = Object.entries(byMech).map(([id, v]) => ({
      mechanicId: id, name: nameOf(id), jobs: v.jobs,
      gross: Math.round(v.gross * 100) / 100, commission: Math.round(v.gross * 4) / 100, payout: Math.round(v.gross * 96) / 100,
    }));
    res.json({ periodStart: start.toISOString(), periodEnd: end.toISOString(), rows });
  } catch (err) {
    console.error('[admin/weekly-report]', err);
    res.status(500).json({ error: 'Could not build report' });
  }
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

// POST /api/admin/onboard-mechanic — a Torqued employee onboards a workshop directly
app.post('/api/admin/onboard-mechanic', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { email, name, address, phone, labour_rate, technicians, parts_lead_days, owner_name } = req.body;
    // billing: 'stripe' (paid link, default) | 'trial' (Stripe link w/ free trial days) | 'comp' (free, activated now)
    const billing: string = req.body.billing || 'stripe';
    const trialDays: number = Number(req.body.trialDays) || 0;
    if (!email || !name) return res.status(400).json({ error: 'Workshop name and email are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const origin = getOrigin(req);

    // Create a pre-confirmed account with a random temporary password
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    let userId: string | null = null;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { name, role: 'mechanic' },
    });
    if (authError) {
      if (/already|registered|exists/i.test(authError.message)) {
        // Account exists — find it and just activate/update the profile
        const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).single();
        userId = existing?.id ?? null;
        if (!userId) return res.status(409).json({ error: 'An account exists but could not be located.' });
      } else {
        return res.status(400).json({ error: authError.message });
      }
    } else {
      userId = authData.user?.id ?? null;
    }
    if (!userId) return res.status(500).json({ error: 'Could not create account' });

    // Geocode the workshop address (free, no key) so distance search works
    let latitude: number | null = null, longitude: number | null = null;
    if (address) {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=nz&q=${encodeURIComponent(address)}`, {
          headers: { 'User-Agent': 'TorquedNZ/1.0 (torquedapp.nz@gmail.com)' },
        });
        const geo = await geoRes.json();
        if (Array.isArray(geo) && geo[0]) { latitude = parseFloat(geo[0].lat); longitude = parseFloat(geo[0].lon); }
      } catch (e) { console.warn('Geocode failed (non-blocking):', (e as Error).message); }
    }

    // Comp accounts go live immediately; paid/trial accounts activate on successful Stripe checkout.
    const compActivate = billing === 'comp';
    await supabase.from('profiles').upsert({
      id: userId, email, name, role: 'mechanic',
      address: address || null, phone: phone || null, owner_name: owner_name || null,
      labour_rate: labour_rate != null && labour_rate !== '' ? Number(labour_rate) : null,
      technicians: technicians != null && technicians !== '' ? Number(technicians) : 1,
      parts_lead_days: parts_lead_days != null && parts_lead_days !== '' ? Number(parts_lead_days) : 1,
      latitude, longitude,
      subscription_active: compActivate,
      onboarding_complete: true,
    }, { onConflict: 'id' });

    // Build the Stripe subscription checkout link (unless comped)
    let billingLink = '';
    if (!compActivate) {
      const sub = await makeSubscriptionCheckout(email, userId, origin, billing === 'trial' ? (trialDays || 30) : 0);
      billingLink = sub.url || '';
    }

    // Magic login link so they can access the portal + set their password
    const { data: link } = await supabase.auth.admin.generateLink({
      type: 'magiclink', email, options: { redirectTo: `${origin}/mechanic` },
    });
    const loginLink = link?.properties?.action_link || `${origin}/mechanic`;

    const transporter = getMailTransporter();
    if (transporter) {
      const activationBlock = compActivate
        ? `<p style="margin:0 0 20px">Your workshop is live on Torqued — complimentary access has been applied. Log in to set up your profile.</p>`
        : `<p style="margin:0 0 8px">To go live and start receiving leads, activate your $99/month subscription${billing === 'trial' ? ` (your first ${trialDays || 30} days are free)` : ''}:</p>
           <p style="margin:0 0 20px"><a href="${billingLink}" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px">Activate subscription</a></p>`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 8px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e6e6ea">
<tr><td style="background:#150402;padding:24px 32px;border-bottom:3px solid #FF1800;text-align:center"><img src="${LOGO_URL}" width="200" height="67" style="width:200px;height:67px;border:0"/></td></tr>
<tr><td style="padding:36px 32px;color:#150402;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">Kia ora ${name},</p>
<p style="margin:0 0 16px">Welcome to Torqued — your workshop account has been created.</p>
${activationBlock}
<p style="margin:0 0 8px">Access your portal:</p>
<p style="margin:0 0 20px"><a href="${loginLink}" style="display:inline-block;background:#150402;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px">Open Garage Portal</a></p>
<p style="margin:24px 0 0;color:#555">Kind regards,<br/>the Torqued team</p>
</td></tr></table></td></tr></table></body></html>`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: compActivate ? 'Your Torqued workshop account is live' : 'Activate your Torqued workshop subscription',
        html,
      }).catch(e => console.warn('Onboard email failed (non-blocking):', e?.message));
    }

    res.json({ success: true, mechanicId: userId, loginLink, billingLink, activated: compActivate });
  } catch (err) {
    console.error('[admin/onboard-mechanic]', err);
    res.status(500).json({ error: 'Onboarding failed' });
  }
});

// POST /api/mechanic/save-onboarding — persist onboarding details (service role)
app.post('/api/mechanic/save-onboarding', async (req, res) => {
  try {
    const { mechanicId, fields, complete } = req.body;
    if (!mechanicId || !fields) return res.status(400).json({ error: 'mechanicId and fields required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const allowed = ['name','nzbn','address','phone','owner_name','bank_account_name','bank_account_number','labour_rate','shop_fee','technicians','parts_lead_days','service_areas','cancellation_notice_hours','cancellation_partial_refund_pct'];
    const update: Record<string, any> = {};
    for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
    if (complete) update.onboarding_complete = true;

    let { error } = await supabase.from('profiles').update(update).eq('id', mechanicId);
    // If migration 012 hasn't been run yet, the cancellation columns won't exist — retry without them
    // so the rest of the capacity/profile save still succeeds.
    if (error && /cancellation_(notice_hours|partial_refund_pct)/.test(error.message || '')) {
      delete update.cancellation_notice_hours;
      delete update.cancellation_partial_refund_pct;
      ({ error } = await supabase.from('profiles').update(update).eq('id', mechanicId));
    }
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

// Chat-style OpenAI call (system + multi-turn). Cheap: gpt-4o-mini, capped tokens.
// Messages may include { role, content, image } — image is a base64 string (with or without data URI prefix).
// Those are expanded into vision content arrays automatically.
async function callOpenAIChat(messages: any[], maxTokens = 500, jsonMode = false): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  // Expand any message that has an image property into vision content format
  const expanded = messages.map(m => {
    if (!m.image) return m;
    const base64 = String(m.image).replace(/^data:image\/[a-z]+;base64,/, '');
    const ext = String(m.image).startsWith('data:image/png') ? 'png' : 'jpeg';
    return {
      role: m.role,
      content: [
        { type: 'text', text: m.content || m.text || '' },
        { type: 'image_url', image_url: { url: `data:image/${ext};base64,${base64}`, detail: 'low' } },
      ],
    };
  });

  const body: any = { model: 'gpt-4o-mini', messages: expanded, max_tokens: maxTokens, temperature: 0.3 };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'OpenAI request failed');
  return data.choices?.[0]?.message?.content ?? '';
}

// POST /api/ai/mechanic-assistant — mechanic data chat with full DB access.
app.post('/api/ai/mechanic-assistant', async (req, res) => {
  try {
    const { messages, vehicle, rego, mechanicId } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI assistant not configured (add OpenAI credit).' });

    const supabase = getSupabaseAdmin();
    let vehicleCtx = vehicle || '';
    let historyCtx = '';
    let bookingsCtx = '';
    let customerCtx = '';

    // Extract rego plates and customer name references from the mechanic's latest message
    const lastMsg = String(messages[messages.length - 1]?.content ?? messages[messages.length - 1]?.text ?? '');
    const mentionedRegos = [...new Set((lastMsg.toUpperCase().match(/\b[A-Z]{1,3}\d{2,4}[A-Z]?\b/g) || []))];
    const nameMatch = lastMsg.match(/(\w+)(?:'s|s')\s+(?:car|vehicle|ute|van|truck|bikes?)/i)
      || lastMsg.match(/(?:cars?|vehicles?)\s+(?:for|owned?\s+by)\s+(\w+)/i);
    const mentionedName = nameMatch?.[1] ?? null;

    const buildVehicleCtx = async (plate: string) => {
      const [vRes, sRes, hRes, bRes] = await Promise.all([
        supabase!.from('vehicles').select('rego,make,model,year,variant,mileage,owner_id').eq('rego', plate).single(),
        supabase!.from('vehicle_specs').select('oil_type,oil_capacity_litres,oil_service_interval_km,transmission_fluid_type,transmission_service_interval_km,cambelt_or_chain,cambelt_interval_km').eq('rego', plate).single(),
        supabase!.from('vehicle_history').select('service_date,work_done,mileage,provider,price').eq('rego', plate).order('service_date', { ascending: false }).limit(15),
        supabase!.from('bookings').select('id,status,service_ids,description,date,quoted_price,total_price,customer_name,email').eq('vehicle_rego', plate).order('created_at', { ascending: false }).limit(10),
      ]);
      let ctx = '';
      if (vRes.data) {
        const v = vRes.data;
        const s = sRes.data;
        ctx = `${v.year || ''} ${v.make || ''} ${v.model || ''}${v.variant ? ` ${v.variant}` : ''} (${plate})${v.mileage ? `, ${Number(v.mileage).toLocaleString()}km` : ''}`;
        if (s) {
          const specs = [
            s.oil_type && `oil: ${s.oil_type}`,
            s.oil_capacity_litres && `capacity: ${s.oil_capacity_litres}L`,
            s.oil_service_interval_km && `service every ${s.oil_service_interval_km}km`,
            s.transmission_fluid_type && `trans fluid: ${s.transmission_fluid_type}`,
            s.cambelt_or_chain && `cambelt/chain: ${s.cambelt_or_chain}${s.cambelt_interval_km ? ` @${s.cambelt_interval_km}km` : ''}`,
          ].filter(Boolean).join(', ');
          if (specs) ctx += ` — ${specs}`;
        }
      }
      if (hRes.data?.length) ctx += '\n  History: ' + hRes.data.map((h: any) => `${h.service_date || '?'}: ${h.work_done || 'service'}${h.mileage ? ` @${h.mileage}km` : ''}${h.price ? ` ($${h.price})` : ''}`).join(' | ');
      if (bRes.data?.length) {
        ctx += '\n  Bookings: ' + bRes.data.map((b: any) => {
          const svc = (b.service_ids || []).map((id: string) => SERVICE_NAMES[id] || id).join(', ') || b.description || 'service';
          return `${b.date?.slice(0, 10) || '?'} – ${svc} (${b.status})${b.quoted_price ? ` $${b.quoted_price}` : ''}`;
        }).join(' | ');
        if (bRes.data[0]?.customer_name) ctx += `\n  Customer: ${bRes.data[0].customer_name}`;
      }
      return ctx;
    };

    if (supabase) {
      // Primary rego context (from focused vehicle in the portal)
      const primaryRego = rego ? String(rego).toUpperCase() : null;
      if (primaryRego) vehicleCtx = await buildVehicleCtx(primaryRego);

      // Additional regos mentioned in the message (e.g., mechanic types "RAH190")
      const extraRegos = mentionedRegos.filter(r => r !== primaryRego).slice(0, 3);
      if (extraRegos.length) {
        const extraCtxs = await Promise.all(extraRegos.map(buildVehicleCtx));
        const validExtras = extraCtxs.filter(Boolean);
        if (validExtras.length) vehicleCtx += (vehicleCtx ? '\n' : '') + validExtras.join('\n');
      }

      // Customer name lookup — "Sri's car" or "cars for Sri"
      if (mentionedName) {
        const { data: matchedProfiles } = await supabase.from('profiles').select('id,name').ilike('name', `%${mentionedName}%`).limit(3);
        if (matchedProfiles?.length) {
          const ownerIds = matchedProfiles.map((p: any) => p.id);
          const { data: ownerVehicles } = await supabase.from('vehicles').select('rego,make,model,year,variant,mileage').in('owner_id', ownerIds);
          if (ownerVehicles?.length) {
            customerCtx = `Vehicles for ${matchedProfiles[0].name}: ` + ownerVehicles.map((v: any) => `${v.rego} – ${v.year} ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''}${v.mileage ? ` @${Number(v.mileage).toLocaleString()}km` : ''}`).join(', ');
          }
        }
      }
    }

    // Workshop jobs for this mechanic
    let workshopCtx = '';
    if (supabase && mechanicId) {
      const { data: wJobs } = await supabase.from('bookings')
        .select('vehicle_rego,service_ids,status,date,customer_name')
        .eq('mechanic_id', mechanicId).in('status', ['pending','accepted','in_progress'])
        .order('date', { ascending: true }).limit(20);
      if (wJobs?.length) workshopCtx = `Workshop queue: ${wJobs.map((j: any) => `${j.vehicle_rego}${j.customer_name ? ` (${j.customer_name})` : ''} – ${(j.service_ids||[]).map((id: string)=>SERVICE_NAMES[id]||id).join(',')||'service'} (${j.status}) ${j.date?.slice(0,10)||''}`).join(' | ')}`;
    }

    // This mechanic's service packages (so AI can quote package pricing)
    let packagesCtx = '';
    if (supabase && mechanicId) {
      const { data: pkgs } = await supabase.from('service_packages')
        .select('name,price,pkg_type,base_fee,oil_grade,oil_litres,oil_cost_per_l,filter_cost,trans_oil_litres,trans_oil_cost_per_l,freight,scan_tool_fee,included_items')
        .eq('mechanic_id', mechanicId);
      if (pkgs?.length) {
        packagesCtx = 'Your service packages:\n' + pkgs.map((p: any) => {
          const pricing = p.pkg_type === 'standard'
            ? `base $${p.base_fee ?? '?'} + ${p.oil_litres ?? '?'}L ${p.oil_grade ?? 'oil'} @$${p.oil_cost_per_l ?? '?'}/L + filter $${p.filter_cost ?? '?'} = $${p.price}`
            : `base $${p.base_fee ?? '?'} + ${p.trans_oil_litres ?? '?'}L trans fluid @$${p.trans_oil_cost_per_l ?? '?'}/L + freight $${p.freight ?? '?'} + scan $${p.scan_tool_fee ?? '?'} = $${p.price}`;
          const items = Array.isArray(p.included_items) && p.included_items.length ? ` | includes: ${p.included_items.join(', ')}` : '';
          return `  • ${p.name} [${p.pkg_type}]: ${pricing}${items}`;
        }).join('\n');
      }
    }

    const ctxParts = [
      vehicleCtx && `Vehicle data:\n${vehicleCtx}`,
      customerCtx,
      workshopCtx,
      packagesCtx,
    ].filter(Boolean).join('\n\n');

    const sys = {
      role: 'system',
      content: `You are the Torqued Mechanic Assistant for New Zealand automotive workshops. You have live read access to the entire Torqued database — vehicles, specs, service history, bookings, and this workshop's service packages.

${ctxParts}

When a mechanic asks about a specific rego or customer name, use the vehicle data above. For oil service pricing, calculate: base_fee + (vehicle's actual oil capacity × oil_cost_per_litre) + filter_cost. Answer concisely: oil capacities, grades, torque specs, service intervals, common faults, part fitments, pricing. NZ metric units. Under ~150 words unless asked for detail. Never invent part numbers.`,
    };

    const normalised = messages.slice(-10).map((m: any) => ({
      role: m.role, content: m.content ?? m.text ?? '', image: m.image || undefined,
    }));
    const reply = await callOpenAIChat([sys, ...normalised], 600);
    res.json({ reply: reply.trim() });
  } catch (err: any) {
    console.error('[ai/mechanic-assistant]', err);
    res.status(500).json({ error: err?.message || 'Assistant failed' });
  }
});

// GET /api/mechanic/:mechanicId/package-price?rego= — calculate the exact package price for a specific vehicle
app.get('/api/mechanic/:mechanicId/package-price', async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const rego = req.query.rego ? String(req.query.rego).toUpperCase().trim() : null;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ packages: [] });

    const [pkgRes, specRes] = await Promise.all([
      supabase.from('service_packages')
        .select('id,name,price,pkg_type,base_fee,oil_grade,oil_litres,oil_cost_per_l,filter_cost,trans_oil_litres,trans_oil_cost_per_l,freight,scan_tool_fee,included_items,duration_min')
        .eq('mechanic_id', mechanicId).order('price'),
      rego ? supabase.from('vehicle_specs').select('oil_capacity_litres,oil_type,transmission_fluid_type,transmission_service_interval_km').eq('rego', rego).single() : Promise.resolve({ data: null }),
    ]);

    const spec = specRes.data;
    const packages = (pkgRes.data ?? []).map((p: any) => {
      let calculatedPrice = p.price; // fallback to stored total
      if (p.pkg_type === 'standard' && spec?.oil_capacity_litres && p.oil_cost_per_l && p.base_fee != null) {
        // Recalculate using vehicle's actual oil capacity
        calculatedPrice = Math.round(p.base_fee + (spec.oil_capacity_litres * p.oil_cost_per_l) + (p.filter_cost || 0));
      } else if (p.pkg_type === 'transmission' && p.base_fee != null) {
        calculatedPrice = Math.round((p.base_fee || 0) + ((p.trans_oil_litres || 0) * (p.trans_oil_cost_per_l || 0)) + (p.freight || 0) + (p.scan_tool_fee || 0));
      }
      return { ...p, calculatedPrice, vehicleOilCapacity: spec?.oil_capacity_litres ?? null };
    });

    res.json({ packages, vehicleSpec: spec ?? null });
  } catch (err) {
    console.error('[package-price]', err);
    res.json({ packages: [] });
  }
});

// GET /api/fleet-prices?rego=ABC123 — return parts_data low/high/midpoint for every catalog service
// for the matched vehicle. Uses vehicle_aliases make/model match. Falls back to {} if unknown.
const FLEET_SERVICE_TO_SLUG: Record<string, string> = {
  oil:                'oil_filter',
  timing:             'cambelt',
  brakes_front_pads:  'front_brake_pads',
  brakes_front_rotors:'front_rotors',
  brakes_rear_pads:   'rear_brake_pads',
  brakes_rear_rotors: 'rear_rotors',
  battery:            'battery_12v',
  spark_plugs:        'ignition_coils',
  cabin_filter:       'cabin_air_filter',
  transmission:       'transmission_filter',
};
app.get('/api/fleet-prices', async (req, res) => {
  try {
    const rego = req.query.rego ? String(req.query.rego).toUpperCase().trim() : null;
    if (!rego) return res.json({ prices: {} });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ prices: {} });

    // 1. Resolve make/model/year from the customer's vehicle record
    const { data: custVehicle } = await supabase
      .from('vehicles').select('make, model, year').eq('rego', rego).single();
    if (!custVehicle?.make) return res.json({ prices: {}, timingDrive: null, vehicleId: null });

    // 2. Match vehicle_models — four-tier fallback:
    //   1. Exact model + year range
    //   2. First-word prefix + year range   ("Tiguan R-Line" → "Tiguan%")
    //   3. Exact model, no year filter      (newer model than fleet DB covers)
    //   4. First-word prefix, no year       (last resort — same make/platform)
    const firstWord = String(custVehicle.model).split(' ')[0];
    const queryVM = async (modelPat: string, withYear: boolean) => {
      let q = (supabase as any)
        .from('vehicle_models')
        .select('id, timing_drive')
        .ilike('make', custVehicle.make)
        .ilike('model', modelPat);
      if (withYear && custVehicle.year) {
        q = q.lte('year_from', custVehicle.year)
             .or(`year_to.is.null,year_to.gte.${custVehicle.year}`);
      }
      const { data } = await q.limit(1);
      return data as any[] | null;
    };

    let vmRows: any[] | null = null;
    vmRows = await queryVM(custVehicle.model, true);
    if (!vmRows?.length && firstWord !== custVehicle.model)
      vmRows = await queryVM(firstWord + '%', true);
    if (!vmRows?.length)
      vmRows = await queryVM(custVehicle.model, false);
    if (!vmRows?.length && firstWord !== custVehicle.model)
      vmRows = await queryVM(firstWord + '%', false);

    if (!vmRows?.length) {
      return res.json({ prices: {}, timingDrive: null, vehicleId: null });
    }
    const vehicleId: string = vmRows[0].id;
    const timingDrive: string | null = vmRows[0].timing_drive ?? null;

    // 3. Fetch all relevant category IDs in one query
    const slugs = Object.values(FLEET_SERVICE_TO_SLUG);
    const { data: cats } = await supabase
      .from('part_categories').select('id, slug').in('slug', slugs);
    if (!cats || cats.length === 0) return res.json({ prices: {} });

    const catIdToSlug: Record<number, string> = Object.fromEntries(cats.map((c: any) => [c.id, c.slug]));
    const slugToServiceId: Record<string, string> = Object.fromEntries(
      Object.entries(FLEET_SERVICE_TO_SLUG).map(([svcId, slug]) => [slug, svcId])
    );

    const catIds = cats.map((c: any) => c.id);

    // 4. Pull parts_data + labour_times together — NZD total = parts + (hours × labour_rate)
    // $185/hr is a conservative NZ workshop rate; mechanics can adjust via their packages.
    const NZD_LABOUR_RATE = 185;
    const [partsRes, labourRes] = await Promise.all([
      supabase.from('parts_data')
        .select('category_id, part_cost_low, part_cost_high')
        .eq('vehicle_id', vehicleId).in('category_id', catIds),
      supabase.from('labour_times')
        .select('category_id, hours_low, hours_high')
        .eq('vehicle_id', vehicleId).in('category_id', catIds),
    ]);

    // Index labour by category_id for O(1) lookup
    const labourByCat: Record<number, { hl: number; hh: number }> = {};
    for (const lt of (labourRes.data ?? []) as any[]) {
      labourByCat[lt.category_id] = { hl: Number(lt.hours_low), hh: Number(lt.hours_high) };
    }

    const prices: Record<string, { low: number; high: number; midpoint: number }> = {};
    for (const row of (partsRes.data ?? []) as any[]) {
      const slug = catIdToSlug[row.category_id];
      const svcId = slug ? slugToServiceId[slug] : null;
      if (!svcId) continue;
      const partsLow = Number(row.part_cost_low);
      const partsHigh = Number(row.part_cost_high);
      const labour = labourByCat[row.category_id];
      const labourLow  = labour ? Math.round(labour.hl * NZD_LABOUR_RATE) : 0;
      const labourHigh = labour ? Math.round(labour.hh * NZD_LABOUR_RATE) : 0;
      const low  = partsLow  + labourLow;
      const high = partsHigh + labourHigh;
      prices[svcId] = { low, high, midpoint: Math.round((low + high) / 2) };
    }
    res.json({ prices, timingDrive, vehicleId });
  } catch (err) {
    console.error('[fleet-prices]', err);
    res.json({ prices: {}, timingDrive: null, vehicleId: null });
  }
});

// Indicative all-in Torqued prices (NZD) — mirrors the booking catalog, used for AI price guidance.
const SERVICE_PRICES: Record<string, { name: string; price: number }> = {
  oil: { name: 'Oil Change', price: 180 }, wof: { name: 'Warrant of Fitness', price: 65 },
  full: { name: 'Full Service', price: 350 }, brakes_front_pads: { name: 'Front Brake Pads', price: 220 },
  brakes_front_rotors: { name: 'Front Rotors & Pads', price: 580 }, brakes_rear_pads: { name: 'Rear Brake Pads', price: 190 },
  brakes_rear_rotors: { name: 'Rear Rotors & Pads', price: 480 }, timing: { name: 'Cambelt & Waterpump', price: 2289 },
  transmission: { name: 'Transmission Service', price: 621 }, battery: { name: 'Battery (12V)', price: 280 },
  diag_inspection: { name: 'Diagnostic Inspection', price: 99 }, spark_plugs: { name: 'Spark Plugs (all four)', price: 240 },
  cabin_filter: { name: 'Cabin Air Filter', price: 110 }, brake_fluid: { name: 'Brake Fluid Flush', price: 145 },
};
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/ai/customer-assistant — customer-facing diagnostic + maintenance chatbot (acute pathway).
// Has the customer's cars + service history + indicative pricing + nearby-mechanic count, and nudges to book.
app.post('/api/ai/customer-assistant', async (req, res) => {
  try {
    const { messages, ownerId, rego, lat, lng } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI assistant not configured (add OpenAI credit).' });

    const supabase = getSupabaseAdmin();
    let vehicles: any[] = [];
    if (supabase) {
      if (ownerId) {
        const { data } = await supabase.from('vehicles').select('rego, make, model, year, variant, mileage').eq('owner_id', ownerId);
        vehicles = data ?? [];
      } else if (rego) {
        const { data } = await supabase.from('vehicles').select('rego, make, model, year, variant, mileage').eq('rego', String(rego).toUpperCase());
        vehicles = data ?? [];
      }
    }
    const focusRego = (rego ? String(rego).toUpperCase() : undefined) || vehicles[0]?.rego;

    let historyLines: string[] = [];
    let activeBookingLines: string[] = [];
    if (supabase && focusRego) {
      const [hRes, bRes] = await Promise.all([
        supabase.from('vehicle_history').select('service_date, work_done, mileage, provider').eq('rego', focusRego).order('created_at', { ascending: false }).limit(15),
        supabase.from('bookings').select('id,service_ids,status,date,description,quoted_price,total_price').eq('vehicle_rego', focusRego).in('status', ['pending','accepted','in_progress','booked']).order('date', { ascending: true }).limit(5),
      ]);
      historyLines = (hRes.data ?? []).map((h: any) => `${h.service_date || '?'}: ${h.work_done || 'service'}${h.mileage ? ` @${h.mileage}km` : ''}${h.provider ? ` (${h.provider})` : ''}`);
      activeBookingLines = (bRes.data ?? []).map((b: any) => {
        const svc = (b.service_ids || []).map((id: string) => SERVICE_NAMES[id] || id).join(', ') || b.description || 'service';
        return `${b.date?.slice(0,10)||'?'}: ${svc} (${b.status})${b.quoted_price ? ` — $${b.quoted_price}` : ''}`;
      });
    }
    // Also load full history across all their vehicles
    if (supabase && ownerId && vehicles.length > 1) {
      const regos = vehicles.map((v: any) => v.rego);
      const { data: allHist } = await supabase.from('vehicle_history').select('rego,service_date,work_done').in('rego', regos).order('created_at', { ascending: false }).limit(20);
      if (allHist) {
        const extra = allHist.filter((h: any) => h.rego !== focusRego).map((h: any) => `${h.rego} ${h.service_date||'?'}: ${h.work_done||'service'}`);
        if (extra.length) historyLines = [...historyLines, ...extra.slice(0, 5)];
      }
    }

    let mechs: any[] = [];
    if (supabase) {
      const { data } = await supabase.from('profiles').select('name, latitude, longitude').eq('role', 'mechanic').eq('subscription_active', true);
      mechs = data ?? [];
    }
    const hasCoords = lat != null && lng != null;
    const nearby = hasCoords ? mechs.filter(m => m.latitude && m.longitude && haversineKm(Number(lat), Number(lng), m.latitude, m.longitude) <= 75) : mechs;
    const mechCount = nearby.length;

    const carLines = vehicles.map((v: any) => `${v.year || ''} ${v.make || ''} ${v.model || ''}${v.variant ? ` ${v.variant}` : ''} (${v.rego})${v.mileage ? ` — ${Number(v.mileage).toLocaleString()}km` : ''}`.trim()).join('; ');
    const priceList = Object.values(SERVICE_PRICES).map(s => `${s.name} ~$${s.price}`).join('; ');

    const sys = {
      role: 'system',
      content: `You are Torqued's friendly New Zealand vehicle assistant for CUSTOMERS (not mechanics). You have full access to the customer's vehicle data, service history, and active bookings.

Customer's vehicle(s): ${carLines || 'unknown — politely ask which car they need help with'}.
Service history for ${focusRego || 'their car'}: ${historyLines.join(' | ') || 'none on file'}.
${activeBookingLines.length ? `Active/upcoming bookings: ${activeBookingLines.join(' | ')}.` : ''}
Indicative Torqued prices (NZD, all-in): ${priceList}.
Torqued workshops ${hasCoords ? 'within ~75km of the customer' : 'available'}: ${mechCount}.

How to respond:
- If you don't know which car they mean (and they have more than one or none on file), ask first.
- Reference their actual service history when answering (e.g. "your last oil change was X months ago").
- If they have an active booking, acknowledge it if relevant (e.g. "I can see you already have a diagnostic booked").
- For a maintenance question: give the typical interval, the signs/symptoms of wear, the indicative Torqued price, and workshop count nearby.
- For a symptom/fault: list the most likely causes, urgency, and recommend Diagnostic Inspection (~$99) if unclear. For safety-critical issues (brakes, steering, tyres, overheating, warning lights) tell them to stop driving.
- ALWAYS end by inviting them to book with Torqued.
- Be warm, concise (under ~160 words), plain English, metric & NZ-specific. Never give unsafe DIY instructions.`,
    };

    const normalised = messages.slice(-10).map((m: any) => ({
      role: m.role, content: m.content ?? m.text ?? '', image: m.image || undefined,
    }));
    const reply = await callOpenAIChat([sys, ...normalised], 450);
    res.json({ reply: reply.trim(), mechanicsNearby: mechCount, focusRego: focusRego || null });
  } catch (err: any) {
    console.error('[ai/customer-assistant]', err);
    res.status(500).json({ error: err?.message || 'Assistant failed' });
  }
});

// POST /api/ai/health-insights — live vehicle health insights from real mileage + history
app.post('/api/ai/health-insights', async (req, res) => {
  try {
    const { rego, make, model, year, mileage, history } = req.body;
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI not configured (add OpenAI credit).' });
    const prompt = `You are an NZ vehicle maintenance analyst. Vehicle: ${year || ''} ${make || ''} ${model || ''} (${rego || ''}), odometer ${mileage || 'unknown'} km.
Service history (most recent first): ${JSON.stringify((history || []).slice(0, 20))}.
Return ONLY JSON: {"insights":[{"title":"short label","detail":"1 sentence, NZ-specific, practical","severity":"good|due|overdue|info"}]}.
Give 3-5 insights based on typical service intervals for THIS make/model and what the history shows is missing or due soon. Don't invent past services. If history is empty, base it on mileage + typical intervals.`;
    const text = await callOpenAIChat([{ role: 'user', content: prompt }], 600, true);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return res.status(422).json({ error: 'Could not parse insights' }); }
    res.json({ insights: Array.isArray(parsed.insights) ? parsed.insights : [] });
  } catch (err: any) {
    console.error('[ai/health-insights]', err);
    res.status(500).json({ error: err?.message || 'Insights failed' });
  }
});

// POST /api/ai/oil-price — looks up current NZ retail price per litre for a given oil grade via OpenAI
app.post('/api/ai/oil-price', async (req, res) => {
  try {
    const { grade } = req.body;
    if (!grade?.trim()) return res.status(400).json({ error: 'Oil grade is required (e.g. 5W-30).' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI not configured (add OpenAI credit).' });
    const prompt = `You are a NZ automotive parts pricing expert with current market knowledge.
What is the approximate current retail price per litre (NZD, incl GST) for ${grade.trim()} engine oil sold in New Zealand?
Consider brands like Castrol, Penrite, Mobil 1, Gulf Western typically stocked at Repco or Supercheap.
Return ONLY JSON: {"pricePerLitre": <number>, "note": "<1 sentence reasoning>"}
Use a realistic mid-market figure. Do not include $ symbol.`;
    const text = await callOpenAIChat([{ role: 'user', content: prompt }], 200, true);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return res.status(422).json({ error: 'Could not parse oil price response.' }); }
    if (typeof parsed.pricePerLitre !== 'number') return res.status(422).json({ error: 'Unexpected response format.' });
    res.json({ pricePerLitre: Math.round(parsed.pricePerLitre * 100) / 100, note: parsed.note || '' });
  } catch (err: any) {
    console.error('[ai/oil-price]', err);
    res.status(500).json({ error: err?.message || 'Oil price lookup failed' });
  }
});

// POST /api/ai/service-lookup — AI lookup for oil/fluid capacity + filter cost given a vehicle or service query
app.post('/api/ai/service-lookup', async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: 'query is required (e.g. Toyota Camry 2.5L 2018).' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI not configured (add OpenAI credit).' });

    const isTransmission = type === 'transmission';
    const prompt = isTransmission
      ? `You are a NZ automotive expert. For the vehicle or transmission service: "${query.trim()}"
Provide the standard transmission fluid (ATF) refill capacity in litres and the approximate NZ retail cost per litre (NZD incl GST) for the correct fluid.
Return ONLY JSON: {"transFluidCapacityL": <number>, "transFluidCostPerL": <number>, "fluidType": "<fluid spec e.g. Dexron VI>", "note": "<1 sentence>"}`
      : `You are a NZ automotive expert. For the vehicle: "${query.trim()}"
Provide: engine oil refill capacity (L), recommended oil grade (e.g. 5W-30), approximate NZ retail oil price per litre (NZD incl GST, mid-market brands like Penrite/Castrol at Repco), and approximate NZ retail price for a compatible oil filter (NZD incl GST).
Return ONLY JSON: {"oilCapacityL": <number>, "oilGrade": "<grade>", "oilCostPerL": <number>, "filterCostNZD": <number>, "note": "<1 sentence>"}`;

    const text = await callOpenAIChat([{ role: 'user', content: prompt }], 300, true);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return res.status(422).json({ error: 'Could not parse AI response.' }); }
    res.json(parsed);
  } catch (err: any) {
    console.error('[ai/service-lookup]', err);
    res.status(500).json({ error: err?.message || 'Service lookup failed' });
  }
});

// ── Mechanic Availability ──────────────────────────────────────────────────────
// GET /api/mechanic/availability — list availability slots + closed periods for a mechanic
app.get('/api/mechanic/availability', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    const supabase = getSupabaseAdmin();
    if (!supabase || !mechanicId) return res.json({ slots: [], closedPeriods: [] });
    const [slotsRes, periodsRes] = await Promise.all([
      supabase.from('mechanic_availability').select('id, day_of_week, start_time, end_time').eq('mechanic_id', mechanicId).order('day_of_week').order('start_time'),
      supabase.from('mechanic_closed_periods').select('id, start_date, end_date, reason').eq('mechanic_id', mechanicId).order('start_date'),
    ]);
    res.json({ slots: slotsRes.data ?? [], closedPeriods: periodsRes.data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/mechanic/availability/replace — replace all slots (from operating hours table save)
app.post('/api/mechanic/availability/replace', async (req, res) => {
  try {
    const { mechanicId, slots } = req.body;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    await supabase.from('mechanic_availability').delete().eq('mechanic_id', mechanicId);
    if (Array.isArray(slots) && slots.length > 0) {
      const rows = slots.map((s: any) => ({
        mechanic_id: mechanicId,
        day_of_week: Number(s.day_of_week),
        start_time: s.start_time,
        end_time: s.end_time,
      }));
      await supabase.from('mechanic_availability').insert(rows);
    }
    const { data } = await supabase.from('mechanic_availability').select('id, day_of_week, start_time, end_time').eq('mechanic_id', mechanicId).order('day_of_week').order('start_time');
    res.json({ slots: data ?? [] });
  } catch (err: any) {
    console.error('[availability/replace]', err);
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/mechanic/availability/slot — add a single availability slot
app.post('/api/mechanic/availability/slot', async (req, res) => {
  try {
    const { mechanicId, dayOfWeek, startTime, endTime } = req.body;
    if (!mechanicId || dayOfWeek == null || !startTime || !endTime) return res.status(400).json({ error: 'mechanicId, dayOfWeek, startTime, endTime required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    const { data, error } = await supabase.from('mechanic_availability').insert({
      mechanic_id: mechanicId, day_of_week: Number(dayOfWeek), start_time: startTime, end_time: endTime,
    }).select('id, day_of_week, start_time, end_time').single();
    if (error) throw error;
    res.json({ slot: data });
  } catch (err: any) {
    console.error('[availability/slot]', err);
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// DELETE /api/mechanic/availability/:id — delete one slot
app.delete('/api/mechanic/availability/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    await supabase.from('mechanic_availability').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/mechanic/closed-periods — add a closed period
app.post('/api/mechanic/closed-periods', async (req, res) => {
  try {
    const { mechanicId, startDate, endDate, reason } = req.body;
    if (!mechanicId || !startDate) return res.status(400).json({ error: 'mechanicId and startDate required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    const { data, error } = await supabase.from('mechanic_closed_periods').insert({
      mechanic_id: mechanicId, start_date: startDate, end_date: endDate || startDate, reason: reason || null,
    }).select('id, start_date, end_date, reason').single();
    if (error) throw error;
    res.json({ period: data });
  } catch (err: any) {
    console.error('[closed-periods]', err);
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// DELETE /api/mechanic/closed-periods/:id — delete a closed period
app.delete('/api/mechanic/closed-periods/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    await supabase.from('mechanic_closed_periods').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// ── Booking Notes ──────────────────────────────────────────────────────────────
// GET /api/booking/:id/notes — list mechanic notes for a booking (newest first)
app.get('/api/booking/:id/notes', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const { data, error } = await supabase.from('booking_notes')
      .select('id, note, author, created_at')
      .eq('booking_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ notes: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/booking/:id/notes — add a mechanic note to a booking
app.post('/api/booking/:id/notes', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const { note, author } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'note required' });
    const { data, error } = await supabase.from('booking_notes')
      .insert({ booking_id: req.params.id, note: note.trim(), author: author || 'mechanic' })
      .select('id, note, author, created_at').single();
    if (error) throw error;
    res.json({ note: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// DELETE /api/booking/:id/notes/:noteId — delete a note
app.delete('/api/booking/:id/notes/:noteId', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const { error } = await supabase.from('booking_notes')
      .delete().eq('id', req.params.noteId).eq('booking_id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// ── Vehicle Photos ─────────────────────────────────────────────────────────────
// GET /api/vehicle-photos/:rego — list all photos for a rego plate
app.get('/api/vehicle-photos/:rego', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const rego = String(req.params.rego).toUpperCase();
    const { data, error } = await supabase.from('vehicle_photos')
      .select('id, rego, booking_id, photo_url, comment, uploaded_by, created_at')
      .eq('rego', rego).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ photos: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/vehicle-photos — upload a photo for a rego (base64 → Supabase Storage)
app.post('/api/vehicle-photos', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const { rego, bookingId, imageBase64, comment, uploadedBy } = req.body;
    if (!rego || !imageBase64) return res.status(400).json({ error: 'rego and imageBase64 required' });
    const plate = String(rego).toUpperCase();

    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max 8MB)' });

    const ext = imageBase64.startsWith('data:image/png') ? 'png' : 'jpg';
    const fileName = `${plate}/${Date.now()}.${ext}`;
    const bucketName = 'vehicle-photos';

    // Create bucket if missing (idempotent)
    await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});

    const { error: uploadErr } = await supabase.storage
      .from(bucketName).upload(fileName, buffer, { contentType: `image/${ext}`, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    const { data, error } = await supabase.from('vehicle_photos')
      .insert({ rego: plate, booking_id: bookingId || null, photo_url: publicUrl, comment: comment || null, uploaded_by: uploadedBy || null })
      .select('id, rego, booking_id, photo_url, comment, uploaded_by, created_at').single();
    if (error) throw error;
    res.json({ photo: data });
  } catch (err: any) {
    console.error('[vehicle-photos/upload]', err);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

// DELETE /api/vehicle-photos/:id — remove a photo record
app.delete('/api/vehicle-photos/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const { error } = await supabase.from('vehicle_photos').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/ai/parts-lookup — AI-assisted NZ parts lookup (name, OEM #, price, suppliers)
app.post('/api/ai/parts-lookup', async (req, res) => {
  try {
    const { query, make, model, year } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: 'query required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI not configured (add OpenAI credit).' });
    const prompt = `You are an NZ auto parts assistant. The mechanic needs: "${query}" for a ${year || ''} ${make || ''} ${model || ''}.
Return ONLY JSON: {"name":"clear part name","oemNumber":"OEM/part number or empty if unsure","estPriceNZD":number_or_null,"suppliers":["NZ suppliers likely to stock it, e.g. Repco, Supercheap Auto, BNT, Partmaster, Appco"],"notes":"short fitment note"}.
Only include an OEM number if you are reasonably confident; otherwise empty string. Price is a rough NZ retail estimate.`;
    const text = await callOpenAIChat([{ role: 'user', content: prompt }], 350, true);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return res.status(422).json({ error: 'Could not parse result' }); }
    res.json(parsed);
  } catch (err: any) {
    console.error('[ai/parts-lookup]', err);
    res.status(500).json({ error: err?.message || 'Lookup failed' });
  }
});

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

// POST /api/customer/save-history — persist reviewed service-history records against vehicle + customer
app.post('/api/customer/save-history', async (req, res) => {
  try {
    const { rego, ownerId, records } = req.body;
    if (!rego || !Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'rego and records are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const plate = String(rego).toUpperCase();
    // Resolve owner from the vehicle if not supplied
    let owner = ownerId || null;
    if (!owner) {
      const { data: v } = await supabase.from('vehicles').select('owner_id').eq('rego', plate).single();
      owner = v?.owner_id ?? null;
    }

    const rows = records.map((r: any) => ({
      rego: plate, owner_id: owner,
      service_date: r.date || null, work_done: r.service || null, provider: r.provider || null,
      mileage: r.mileage != null && r.mileage !== '' ? Number(r.mileage) : null,
      price: r.price || null, notes: r.notes || null, source: 'import',
    }));
    const { error } = await supabase.from('vehicle_history').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, saved: rows.length });
  } catch (err) {
    console.error('[save-history]', err);
    res.status(500).json({ error: 'Could not save history' });
  }
});

// GET /api/customer/profile — name/email/phone for a customer (used by the iOS app greeting + profile editor)
app.get('/api/customer/profile', async (req, res) => {
  try {
    const ownerId = req.query.ownerId as string | undefined;
    const rego = (req.query.rego as string | undefined)?.toUpperCase().trim();
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({});
    let owner = ownerId || null;
    if (!owner && rego) {
      const { data: v } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
      owner = v?.owner_id ?? null;
    }
    if (!owner) return res.json({});
    const { data: p } = await supabase.from('profiles').select('id, name, email, phone').eq('id', owner).single();
    res.json({ ownerId: owner, name: p?.name ?? null, email: p?.email ?? null, phone: p?.phone ?? null });
  } catch (err) {
    console.error('[customer/profile]', err);
    res.json({});
  }
});

// POST /api/customer/update-profile — customer edits their own name/email/phone (by ownerId or rego)
app.post('/api/customer/update-profile', async (req, res) => {
  try {
    const { ownerId, rego, name, email, phone } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    let owner = ownerId || null;
    if (!owner && rego) {
      const { data: v } = await supabase.from('vehicles').select('owner_id').eq('rego', String(rego).toUpperCase().trim()).single();
      owner = v?.owner_id ?? null;
    }
    if (!owner) return res.status(400).json({ error: 'Could not resolve your account.' });
    const update: Record<string, any> = {};
    if (typeof name === 'string') update.name = name.trim();
    if (typeof email === 'string' && email.trim()) update.email = email.trim();
    if (typeof phone === 'string') update.phone = phone.trim();
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const { error } = await supabase.from('profiles').update(update).eq('id', owner);
    if (error) return res.status(500).json({ error: error.message });
    // Keep the auth email in sync if it changed
    if (update.email) { try { await supabase.auth.admin.updateUserById(owner, { email: update.email }); } catch {} }
    const { data: p } = await supabase.from('profiles').select('name, email, phone').eq('id', owner).single();
    res.json({ success: true, ownerId: owner, name: p?.name ?? null, email: p?.email ?? null, phone: p?.phone ?? null });
  } catch (err) {
    console.error('[customer/update-profile]', err);
    res.status(500).json({ error: 'Could not update profile' });
  }
});

// POST /api/customer/update-history — edit an imported/manual service-history row the customer owns
app.post('/api/customer/update-history', async (req, res) => {
  try {
    const { id, fields } = req.body;
    if (!id || !fields) return res.status(400).json({ error: 'id and fields are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const update: Record<string, any> = {};
    if (fields.service !== undefined) update.work_done = fields.service;
    if (fields.date !== undefined) update.service_date = fields.date || null;
    if (fields.provider !== undefined) update.provider = fields.provider || null;
    if (fields.mileage !== undefined) update.mileage = fields.mileage !== '' && fields.mileage != null ? Number(fields.mileage) : null;
    if (fields.price !== undefined) update.price = fields.price || null;
    if (fields.notes !== undefined) update.notes = fields.notes || null;
    const { error } = await supabase.from('vehicle_history').update(update).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[customer/update-history]', err);
    res.status(500).json({ error: 'Could not update record' });
  }
});

// POST /api/customer/delete-history — remove an imported/manual service-history row
app.post('/api/customer/delete-history', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('vehicle_history').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[customer/delete-history]', err);
    res.status(500).json({ error: 'Could not delete record' });
  }
});

// POST /api/customer/notifications/dismiss — delete a single notification (the "clear" action)
app.post('/api/customer/notifications/dismiss', async (req, res) => {
  try {
    const { id, ownerId } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    if (id) await supabase.from('notifications').delete().eq('id', id);
    else if (ownerId) await supabase.from('notifications').delete().eq('owner_id', ownerId);
    else return res.status(400).json({ error: 'id or ownerId required' });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications/dismiss]', err);
    res.status(500).json({ error: 'Could not clear notification' });
  }
});

// POST /api/ai/summarize — short plain-English summary of a long message (for the iOS "AI summary")
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { text, style } = req.body;
    if (!text || String(text).trim().length === 0) return res.status(400).json({ error: 'text is required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI summary is not configured yet.' });
    const system = style === 'title'
      ? 'You turn a vehicle service description into a short headline of the key work, Title Case, max ~8 words, items joined with " & " or ", ". Example: "Cambelt & Water Pump Replaced, Oil & Filter Service". No prices, no dates, no preamble.'
      : 'You summarise a vehicle workshop message for the car owner in 1–2 short, plain sentences. Keep any prices, dates and required actions. No preamble.';
    const summary = await callOpenAIChat([
      { role: 'system', content: system },
      { role: 'user', content: String(text).slice(0, 4000) },
    ], style === 'title' ? 40 : 160);
    res.json({ summary: summary.trim() });
  } catch (err) {
    console.error('[ai/summarize]', err);
    res.status(500).json({ error: 'Could not summarise' });
  }
});

// ── Cancellation policy + booking detail + cancel/reschedule (shared by app + website) ──

// NZ national public holidays — days the workshop is closed (excluded from the notice window).
const NZ_HOLIDAYS = new Set<string>([
  '2026-01-01','2026-01-02','2026-02-06','2026-04-03','2026-04-06','2026-04-25','2026-06-01','2026-06-29','2026-10-26','2026-12-25','2026-12-28',
  '2027-01-01','2027-01-04','2027-02-06','2027-03-26','2027-03-29','2027-04-26','2027-06-07','2027-07-09','2027-10-25','2027-12-27','2027-12-28',
]);
function isOpenDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;            // weekend
  return !NZ_HOLIDAYS.has(d.toISOString().slice(0, 10)); // public holiday
}
/** Hours of *open* notice between now and the drop-off (excludes weekends + public holidays). */
function openNoticeHours(now: Date, dropoff: Date): number {
  if (dropoff <= now) return 0;
  let hours = 0;
  const cursor = new Date(now); cursor.setMinutes(0, 0, 0);
  while (cursor < dropoff) {
    if (isOpenDay(cursor)) hours++;
    cursor.setHours(cursor.getHours() + 1);
  }
  return hours;
}
/** Mechanic cancellation policy with safe defaults (tolerant of the migration not being run yet). */
async function getMechanicPolicy(supabase: any, mechanicId: string | null): Promise<{ noticeHours: number; partialPct: number }> {
  const def = { noticeHours: 72, partialPct: 80 };
  if (!supabase || !mechanicId) return def;
  const { data, error } = await supabase.from('profiles')
    .select('cancellation_notice_hours, cancellation_partial_refund_pct').eq('id', mechanicId).single();
  if (error || !data) return def;
  return {
    noticeHours: data.cancellation_notice_hours ?? 72,
    partialPct: data.cancellation_partial_refund_pct ?? 80,
  };
}
function bookingPaidAmount(b: any): number {
  return b.quoted_price != null ? Number(b.quoted_price) : (Number(b.total_price) || 0);
}

// GET /api/booking/:id/detail — full job detail for the customer: mechanic profile, car + work,
// itemised quote (parts + labour), cancellation policy and a refund preview. Powers web + app.
app.get('/api/booking/:id/detail', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: b } = await supabase.from('bookings').select('*').eq('id', req.params.id).single();
    if (!b) return res.status(404).json({ error: 'Booking not found' });

    let vehicleLabel = `(${b.vehicle_rego})`;
    if (b.vehicle_rego) {
      const { data: v } = await supabase.from('vehicles').select('make, model, year').eq('rego', b.vehicle_rego).single();
      if (v?.make) vehicleLabel = `${v.year ? v.year + ' ' : ''}${v.make} ${v.model || ''}`.trim() + ` (${b.vehicle_rego})`;
    }
    let mechanic: any = null;
    if (b.mechanic_id) {
      const { data: m } = await supabase.from('profiles')
        .select('id, name, address, phone, rating, review_count, labour_rate, banner_image').eq('id', b.mechanic_id).single();
      mechanic = m || null;
    }
    const policy = await getMechanicPolicy(supabase, b.mechanic_id);
    const notice = openNoticeHours(new Date(), b.date ? new Date(b.date) : new Date());
    const full = notice >= policy.noticeHours;
    const paid = b.payment_status === 'confirmed' && !!b.stripe_session_id;
    const amount = bookingPaidAmount(b);
    const refundPct = full ? 100 : policy.partialPct;
    const refundAmount = paid ? Math.round(amount * (refundPct / 100) * 100) / 100 : 0;

    res.json({
      id: b.id, rego: b.vehicle_rego, vehicleLabel, serviceIds: b.service_ids || [],
      description: b.description || '', status: b.status, paymentStatus: b.payment_status,
      date: b.date, quotedPrice: b.quoted_price != null ? Number(b.quoted_price) : null,
      total: amount, quoteItems: b.quote_items || null, quoteNote: b.quote_note || '',
      mechanic, policy,
      cancellation: { noticeHours: notice, requiredHours: policy.noticeHours, fullRefund: full,
                      refundPct, refundAmount, paid },
    });
  } catch (err) {
    console.error('[booking/detail]', err);
    res.status(500).json({ error: 'Could not load booking' });
  }
});

// POST /api/customer/request-cancellation — customer cancels a job; applies the mechanic's policy
// (full refund if enough open-hours notice, else partial %) and processes the Stripe refund.
app.post('/api/customer/request-cancellation', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: b } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    if (b.status === 'cancelled') return res.status(400).json({ error: 'This booking is already cancelled.' });

    const policy = await getMechanicPolicy(supabase, b.mechanic_id);
    const notice = openNoticeHours(new Date(), b.date ? new Date(b.date) : new Date());
    const full = notice >= policy.noticeHours;
    const paid = b.payment_status === 'confirmed' && !!b.stripe_session_id;
    const amount = bookingPaidAmount(b);
    const refundPct = full ? 100 : policy.partialPct;
    let refundAmount = paid ? Math.round(amount * (refundPct / 100) * 100) / 100 : 0;

    // Process the Stripe refund (full → refund everything; partial → refund the % amount).
    if (paid && refundAmount > 0) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const session = await stripe.checkout.sessions.retrieve(b.stripe_session_id);
          const paymentIntent = session.payment_intent as string;
          if (paymentIntent) {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntent,
              ...(full ? {} : { amount: Math.round(refundAmount * 100) }),
            });
            refundAmount = (refund.amount || 0) / 100;
            await supabase.from('platform_events').insert({
              type: 'refund', amount: refundAmount, mechanic_id: b.mechanic_id, booking_id: bookingId,
              note: full ? 'Cancellation — full refund' : `Cancellation — ${refundPct}% (short notice)`,
            });
          }
        } catch (e) { console.error('[request-cancellation] refund failed', (e as Error).message); }
      }
    }

    await supabase.from('bookings').update({
      status: 'cancelled',
      payment_status: paid ? (full ? 'refunded' : 'partially_refunded') : b.payment_status,
      refunded_amount: (Number(b.refunded_amount) || 0) + refundAmount,
    }).eq('id', bookingId);

    // Tell the workshop.
    const ctx = await getBookingContext(bookingId);
    if (ctx.mechanicEmail) {
      try {
        const t = getMailTransporter();
        if (t) await t.sendMail({
          from: process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>',
          to: ctx.mechanicEmail, replyTo: ctx.email || undefined,
          subject: `Booking cancelled: Ref #${bookingId} (${ctx.vehicleLabel})`,
          html: `<p>${ctx.custName || 'A customer'} cancelled their booking for <b>${ctx.vehicleLabel}</b>.</p>
                 <p>Notice given: ${notice}h of open time (policy: ${policy.noticeHours}h).
                 Refund issued: ${full ? 'full' : refundPct + '%'} — $${refundAmount.toFixed(2)}.</p>`,
        });
      } catch {}
    }
    // In-app notification (shows on iOS + web).
    await notify({ bookingId, type: 'service_reminder', title: 'Booking cancelled',
      body: full ? 'Your booking was cancelled with a full refund.'
                 : `Your booking was cancelled. A ${refundPct}% refund ($${refundAmount.toFixed(2)}) was issued per the workshop's policy.` });

    // Confirmation email to the customer.
    const custTo = b.email || ctx.email;
    if (custTo) {
      try {
        const t = getMailTransporter();
        if (t) {
          const refundLine = paid
            ? (full
                ? `<p style="margin:0 0 16px">A <strong>full refund of $${refundAmount.toFixed(2)}</strong> has been issued to your original payment method (allow 5–10 business days).</p>`
                : `<p style="margin:0 0 16px">As this was short notice (less than ${policy.noticeHours} hours of open time before drop-off), a <strong>${refundPct}% refund of $${refundAmount.toFixed(2)}</strong> has been issued per ${ctx.mechanicName || 'the workshop'}'s cancellation policy.</p>`)
            : `<p style="margin:0 0 16px">No payment had been taken, so there's nothing to refund.</p>`;
          const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
<div style="background:#150402;padding:24px;text-align:center"><img src="${LOGO_URL}" width="180" style="height:auto"/></div>
<div style="padding:32px;color:#150402;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">Dear ${ctx.custName ? ctx.custName.split(' ')[0] : 'there'},</p>
<p style="margin:0 0 16px">Your booking for <strong>${ctx.vehicleLabel}</strong>${ctx.mechanicName ? ` with ${ctx.mechanicName}` : ''} (Ref #${bookingId}) has been <strong>cancelled</strong>.</p>
${refundLine}
<p style="margin:0;color:#555;font-size:13px">Changed your mind? You can re-book anytime in the Torqued app or at torquednz.vercel.app.</p>
</div></div>`;
          await t.sendMail({
            from: process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>',
            to: custTo, subject: `Your Torqued booking was cancelled (Ref #${bookingId})`, html,
          });
        }
      } catch (e) { console.error('[request-cancellation] customer email failed', (e as Error).message); }
    }

    res.json({ success: true, fullRefund: full, refundPct, refundAmount,
               noticeHours: notice, requiredHours: policy.noticeHours });
  } catch (err) {
    console.error('[request-cancellation]', err);
    res.status(500).json({ error: 'Could not cancel booking' });
  }
});

// POST /api/customer/reschedule — change a booking's drop-off date/time (availability is enforced
// client-side using the same engine as the initial booking). Notifies the workshop.
app.post('/api/customer/reschedule', async (req, res) => {
  try {
    const { bookingId, date } = req.body;
    if (!bookingId || !date) return res.status(400).json({ error: 'bookingId and date are required' });
    const when = new Date(date);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Please choose a future drop-off time.' });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('bookings').update({ date }).eq('id', bookingId);
    if (error) return res.status(500).json({ error: error.message });

    const ctx = await getBookingContext(bookingId);
    if (ctx.mechanicEmail) {
      try {
        const t = getMailTransporter();
        if (t) await t.sendMail({
          from: process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>',
          to: ctx.mechanicEmail, replyTo: ctx.email || undefined,
          subject: `Booking rescheduled: Ref #${bookingId} (${ctx.vehicleLabel})`,
          html: `<p>${ctx.custName || 'A customer'} rescheduled their booking for <b>${ctx.vehicleLabel}</b> to <b>${when.toLocaleString('en-NZ')}</b>.</p>`,
        });
      } catch {}
    }
    await notify({ bookingId, type: 'dropoff_reminder', title: 'Booking rescheduled',
      body: `Your drop-off is now ${when.toLocaleString('en-NZ')}.` });
    res.json({ success: true, date });
  } catch (err) {
    console.error('[reschedule]', err);
    res.status(500).json({ error: 'Could not reschedule' });
  }
});

// POST /api/ai/parse-receipt — extracts service history from a receipt image via OpenAI vision
app.post('/api/ai/parse-receipt', async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) return res.status(400).json({ error: 'fileData and mimeType are required' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI receipt scanning is not configured yet.' });

    const isPdf = String(mimeType).includes('pdf');

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

    const fileBlock = isPdf
      ? { type: 'file', file: { filename: 'receipt.pdf', file_data: `data:application/pdf;base64,${fileData}` } }
      : { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileData}` } };

    const text = await callOpenAI([
      { type: 'text', text: prompt },
      fileBlock,
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
  // Attach any saved/imported service history for this vehicle
  const { data: history } = await supabase
    .from('vehicle_history').select('*').eq('rego', formattedRego).order('created_at', { ascending: false });
  res.json({ ...data, history: history ?? [] });
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
      const { type, bookingId, mechanicId, source } = session.metadata ?? {};

      if (type === 'repair_payment' && bookingId) {
        // Don't overwrite an existing customer email with Stripe's if we already have one on the booking.
        const update: Record<string, any> = {
          payment_status: 'confirmed', status: 'booked', stripe_session_id: session.id,
        };
        if (session.customer_details?.email) update.email = session.customer_details.email;
        if (session.customer_details?.name) update.customer_name = session.customer_details.name;
        if (session.customer_details?.phone) update.phone = session.customer_details.phone;
        const { error } = await supabase.from('bookings').update(update).eq('id', bookingId);
        if (error) console.error('[Webhook] Failed to update booking:', error.message);
        else console.log(`[Webhook] Booking ${bookingId} confirmed via payment`);

        // In-app (iOS) bookings get NO web success page, so send the confirmation email here,
        // built from the actual booking row so it always matches what was booked.
        if (source === 'ios') {
          await sendBookingConfirmationEmails(bookingId);
          await notify({ bookingId, type: 'service_reminder', title: 'Booking confirmed',
                         body: 'Your booking is confirmed. Tap to view the details.' });
        }
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
// Shared: create a $99/mo subscription checkout session (optionally with a free-trial). Returns {url,...}.
async function makeSubscriptionCheckout(email: string, mechanicId: string, origin: string, trialDays?: number) {
  const stripe = getStripe();
  if (!stripe) {
    return { id: 'mock_sub_session_id', url: `${origin}/mechanic?session_id=mock_sub_session_id&mechanic_id=${mechanicId}`, isMock: true };
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [{
      price_data: {
        currency: 'nzd',
        recurring: { interval: 'month' },
        product_data: { name: 'Torqued Garage Portal Subscription', description: 'Access to NZ-wide high-value repair marketplace leads' },
        unit_amount: 9900,
      },
      quantity: 1,
    }],
    ...(trialDays && trialDays > 0 ? { subscription_data: { trial_period_days: trialDays } } : {}),
    success_url: `${origin}/mechanic?session_id={CHECKOUT_SESSION_ID}&mechanic_id=${mechanicId}`,
    cancel_url: `${origin}/mechanic?canceled=true`,
    customer_email: email,
    metadata: { mechanicId, type: 'subscription' },
  } as any);
  return { id: session.id, url: session.url };
}

app.post('/api/stripe/create-subscription', async (req, res) => {
  try {
    const { email, mechanicId } = req.body;
    if (!email || !mechanicId) return res.status(400).json({ error: 'Email and mechanicId are required' });
    const out = await makeSubscriptionCheckout(email, mechanicId, getOrigin(req));
    res.json(out);
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

// POST /api/mechanic/billing-portal — Stripe billing portal session to update the card
app.post('/api/mechanic/billing-portal', async (req, res) => {
  try {
    const { mechanicId } = req.body;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    const stripe = getStripe();
    if (!supabase || !stripe) return res.status(500).json({ error: 'Not configured' });
    const { data: p } = await supabase.from('profiles').select('stripe_subscription_id').eq('id', mechanicId).single();
    if (!p?.stripe_subscription_id) return res.status(400).json({ error: 'No active Stripe subscription on file.' });
    const sub: any = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.customer as string,
      return_url: `${getOrigin(req)}/mechanic`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing-portal]', err);
    res.status(500).json({ error: 'Could not open billing portal' });
  }
});

// GET /api/mechanic/billing?mechanicId= — subscription status + payment history from Stripe
app.get('/api/mechanic/billing', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ active: false, invoices: [] });
    const { data: p } = await supabase.from('profiles').select('subscription_active, stripe_subscription_id').eq('id', mechanicId).single();
    const active = !!p?.subscription_active;
    const stripe = getStripe();
    if (!stripe || !p?.stripe_subscription_id) {
      return res.json({ active, status: active ? 'active' : 'inactive', invoices: [], note: p?.stripe_subscription_id ? undefined : 'No Stripe subscription on file (comp or promo account).' });
    }
    let status = active ? 'active' : 'inactive', nextBilling: number | null = null, customer: string | undefined;
    try {
      const sub: any = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
      status = sub.status; nextBilling = sub.current_period_end ? sub.current_period_end * 1000 : null; customer = sub.customer;
    } catch {}
    let invoices: any[] = [];
    if (customer) {
      try {
        const list = await stripe.invoices.list({ customer, limit: 12 });
        invoices = list.data.map((inv: any) => ({
          id: inv.id, date: inv.created * 1000, amount: (inv.amount_paid || inv.amount_due || 0) / 100,
          status: inv.status, url: inv.hosted_invoice_url || null, pdf: inv.invoice_pdf || null,
        }));
      } catch {}
    }
    res.json({ active, status, nextBilling, invoices });
  } catch (err) {
    console.error('[mechanic/billing]', err);
    res.status(500).json({ error: 'Could not load billing' });
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
                Thank you, ${customerName}. Your <strong>${vehicle}</strong> booking is confirmed and payment has been processed.
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
                    Payment
                  </td>
                  <td style="padding: 16px 0; text-align: right; font-family: -apple-system, Arial, sans-serif; font-size: 13.5px; font-weight: 900; color: #150402; text-transform: uppercase;">
                    ${paymentOption === 'deposit' ? 'Deposit paid' : 'Paid in full'}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 4px;">
                    <div style="background-color: #150402; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-family: -apple-system, Arial, sans-serif; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block; vertical-align: middle;">
                      GATEWAY: ${paymentMethod}
                    </div>
                    <span style="display:inline-block; margin-left:8px; font-size:11px; color:rgba(21,4,2,0.5); vertical-align: middle;">Full breakdown in your portal &amp; invoice.</span>
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
    const { amount, bookingId, customerEmail, description, bookingData, userId, source } = req.body;
    if (!amount || !bookingId) {
      return res.status(400).json({ error: 'Amount and bookingId are required' });
    }
    const isIOS = source === 'ios';   // native app → return to an app-friendly acknowledgment page

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

    // Persist booking to Supabase before redirecting to Stripe (even for anonymous
    // customers — keyed on mechanic so it shows in the mechanic/admin portals).
    if (bookingData) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase.from('bookings').upsert({
          id: bookingId,
          customer_id: userId || null,
          mechanic_id: bookingData.mechanicId,
          vehicle_rego: bookingData.vehicleId || null,
          service_ids: bookingData.serviceIds || [],
          status: 'pending_payment',
          payment_status: 'pending',
          payment_method: bookingData.paymentMethod || null,
          date: bookingData.date || null,
          total_price: bookingData.totalPrice || 0,
          deposit_paid: bookingData.depositPaid ?? null,
          customer_name: bookingData.customerName || null,
          email: bookingData.email || customerEmail || null,
          description: bookingData.description || null,
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

      success_url: isIOS
        ? `${origin}/app-paid?booking=${bookingId}&session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/customer?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
      cancel_url: isIOS ? `${origin}/app-cancelled?booking=${bookingId}` : `${origin}/customer?canceled=true`,
      customer_email: isPlaceholderEmail(customerEmail) ? undefined : customerEmail.trim(),
      metadata: {
        bookingId,
        type: 'repair_payment',
        source: isIOS ? 'ios' : 'web'
      }
    } as any);

    // Store the session id on the booking so refunds work even without webhooks
    if (bookingData) {
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

        // NOTE: the 12-month service reminder is intentionally NOT sent here.
        // Scheduled reminders should only fire when actually due (future cron),
        // not on booking/registration.

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
