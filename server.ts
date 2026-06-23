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
const LOGO_URL = 'https://torqued-psi.vercel.app/torqued-logo.png';

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
  // SITE_URL env var is the canonical production origin — always wins when set
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
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

function parseUADeviceName(ua: string): string {
  if (!ua) return 'Unknown device';
  // OS detection
  let os = '';
  const macMatch = ua.match(/Mac OS X ([\d_]+)/);
  if (macMatch) os = 'macOS ' + macMatch[1].replace(/_/g, '.');
  else if (/iPhone/.test(ua)) { const m = ua.match(/iPhone OS ([\d_]+)/); os = 'iOS ' + (m ? m[1].replace(/_/g, '.') : ''); }
  else if (/iPad/.test(ua)) { const m = ua.match(/CPU OS ([\d_]+)/); os = 'iPadOS ' + (m ? m[1].replace(/_/g, '.') : ''); }
  else if (/Android/.test(ua)) { const m = ua.match(/Android ([\d.]+)/); os = 'Android ' + (m ? m[1] : ''); }
  else if (/Windows NT/.test(ua)) { const m = ua.match(/Windows NT ([\d.]+)/); const v: Record<string,string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }; os = 'Windows ' + (m ? (v[m[1]] || m[1]) : ''); }
  else if (/Linux/.test(ua)) os = 'Linux';
  // Browser detection
  let browser = '';
  const chromeMatch = ua.match(/Chrome\/([\d]+)/);
  const safariMatch = ua.match(/Version\/([\d]+).*Safari/);
  const ffMatch = ua.match(/Firefox\/([\d]+)/);
  const edgeMatch = ua.match(/Edg\/([\d]+)/);
  if (edgeMatch) browser = 'Edge ' + edgeMatch[1];
  else if (chromeMatch && !/Chromium/.test(ua)) browser = 'Chrome ' + chromeMatch[1];
  else if (safariMatch) browser = 'Safari ' + safariMatch[1];
  else if (ffMatch) browser = 'Firefox ' + ffMatch[1];
  return [os, browser].filter(Boolean).join(', ') || 'Unknown device';
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

// ── Shared email base ────────────────────────────────────────────────────────
// Raleway (Google Fonts) for headings, Avenir for body text, light-mode default
const EMAIL_FONT_IMPORT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:wght@700;900&display=swap">`;
const EMAIL_BODY_FONT = `'Avenir Next', 'Avenir', -apple-system, 'Segoe UI', Arial, sans-serif`;
const EMAIL_TITLE_FONT = `'Raleway', 'Avenir Next', Arial, sans-serif`;
const EMAIL_BG = '#f5f4f2';
const EMAIL_CARD = '#ffffff';
const EMAIL_DARK = '#150402';
const EMAIL_RED = '#FF1800';
const EMAIL_MUTED = '#64748b';

function emailWrap(content: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">${EMAIL_FONT_IMPORT}<style>body{margin:0;padding:0;background:${EMAIL_BG};font-family:${EMAIL_BODY_FONT}}</style></head>
<body style="margin:0;padding:0;background:${EMAIL_BG};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BG};padding:32px 8px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${EMAIL_CARD};border-radius:20px;overflow:hidden;border:1px solid #e2e0dc;">
<tr><td style="background:${EMAIL_DARK};padding:22px 32px;border-bottom:3px solid ${EMAIL_RED};text-align:center;"><img src="${LOGO_URL}" width="180" height="60" alt="Torqued" style="display:inline-block;border:0;width:180px;height:60px;" /></td></tr>
${content}
<tr><td style="background:#f8f7f5;border-top:1px solid #e2e0dc;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:10px;font-family:${EMAIL_BODY_FONT};color:#aaa;">Torqued NZ &nbsp;·&nbsp; <a href="mailto:torqued.nz@icloud.com" style="color:#aaa;text-decoration:none;">torqued.nz@icloud.com</a> &nbsp;·&nbsp; <a href="https://torqued-psi.vercel.app/privacy-policy.pdf" style="color:#aaa;text-decoration:none;">Privacy Policy</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

function emailTitle(text: string): string {
  return `<h1 style="margin:0 0 10px;font-family:${EMAIL_TITLE_FONT};font-size:22px;font-weight:900;color:${EMAIL_DARK};letter-spacing:-0.3px;">${text}</h1>`;
}

function emailPara(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${EMAIL_BODY_FONT};font-size:14px;line-height:1.6;color:#374151;">${html}</p>`;
}

function emailGreeting(name: string | null | undefined): string {
  return emailPara(`Kia ora${name ? ` <strong>${name.split(' ')[0]}</strong>` : ''},`);
}

function generateMagicEmailHtml(rego: string, link: string, appLink?: string, customerName?: string): string {
  return emailWrap(`<tr><td style="padding:36px 32px;text-align:center;">
<span style="display:inline-block;background:rgba(255,24,0,.08);color:${EMAIL_RED};font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 12px;border-radius:6px;font-family:${EMAIL_BODY_FONT};">VEHICLE VERIFICATION</span>
<div style="margin:18px 0 0;">${emailTitle("Confirm it's you")}</div>
${emailGreeting(customerName)}
${emailPara(`Tap below to securely access the history for <strong style="color:${EMAIL_RED};">${rego}</strong>.`)}
<a href="${link}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_TITLE_FONT};font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:14px 34px;border-radius:12px;">Verify &amp; Continue</a>
${appLink ? `<p style="margin:14px 0 0;font-family:${EMAIL_BODY_FONT};font-size:12px;"><a href="${appLink}" style="color:${EMAIL_RED};font-weight:700;text-decoration:none;">📱 Open in the Torqued app</a></p>` : ''}
<p style="margin:24px 0 0;font-family:${EMAIL_BODY_FONT};font-size:11px;color:#aaa;line-height:1.5;">Link expires in 15 minutes. Didn't request this? You can safely ignore this email.<br/><a href="${link}" style="color:#aaa;word-break:break-all;">${link}</a></p>
</td></tr>`);
}

// Create a magic token, email the link, and return delivery info (+ fallback link if email fails)
async function sendMagicLink(rego: string, email: string, origin: string, customerName?: string) {
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
        html: generateMagicEmailHtml(rego, link, appLink, customerName),
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

function generateOtpEmailHtml(rego: string, code: string, customerName?: string): string {
  return emailWrap(`<tr><td style="padding:36px 32px;text-align:center;">
<span style="display:inline-block;background:rgba(255,24,0,.08);color:${EMAIL_RED};font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 12px;border-radius:6px;font-family:${EMAIL_BODY_FONT};">VEHICLE VERIFICATION</span>
<div style="margin:18px 0 0;">${emailTitle('Your one-time code')}</div>
${emailGreeting(customerName)}
${emailPara(`Enter this code to verify ownership of <strong style="color:${EMAIL_DARK};">${rego}</strong>:`)}
<div style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:monospace;font-size:38px;font-weight:900;letter-spacing:10px;padding:16px 28px;border-radius:14px;margin:4px 0 20px;">${code}</div>
<p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:12px;color:#aaa;">Expires in <strong>10 minutes</strong> &bull; one-time use only</p>
<p style="margin:24px 0 0;font-family:${EMAIL_BODY_FONT};font-size:11px;color:#bbb;line-height:1.5;">Didn't request this? Someone entered your plate number. You can safely ignore this email.</p>
</td></tr>`);
}

function generateMechanicConfirmEmailHtml(name: string, link: string): string {
  return emailWrap(`<tr><td style="padding:36px 32px;text-align:center;">
<span style="display:inline-block;background:rgba(255,24,0,.08);color:${EMAIL_RED};font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 12px;border-radius:6px;font-family:${EMAIL_BODY_FONT};">PARTNER HUB</span>
<div style="margin:18px 0 0;">${emailTitle('Your workshop account is ready')}</div>
${emailGreeting(name)}
${emailPara(`Welcome to Torqued. Your workshop account is active and ready to go — log in to set up your profile and start receiving jobs.`)}
<a href="${link}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_TITLE_FONT};font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:14px 34px;border-radius:12px;">Open my portal</a>
<p style="margin:24px 0 0;font-family:${EMAIL_BODY_FONT};font-size:11px;color:#aaa;line-height:1.5;">Or paste this link into your browser:<br/><a href="${link}" style="color:#aaa;word-break:break-all;">${link}</a></p>
<p style="margin:16px 0 0;font-family:${EMAIL_BODY_FONT};font-size:11px;color:#bbb;">Didn't sign up? You can safely ignore this email.</p>
</td></tr>`);
}

// GET /api/mechanics — real mechanics (active subscription) for the customer to choose from
app.get('/api/mechanics', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ mechanics: [] });
    let data: any;
    const first = await supabase
      .from('profiles')
      .select('id, name, address, labour_rate, technicians, parts_lead_days, rating, review_count, latitude, longitude, offers_ppi, wof_disabled')
      .eq('role', 'mechanic')
      .eq('subscription_active', true);
    data = first.data;
    // Pre-migration: wof_disabled column may not exist yet — retry without it.
    if (first.error && /wof_disabled/.test(first.error.message || '')) {
      const second = await supabase
        .from('profiles')
        .select('id, name, address, labour_rate, technicians, parts_lead_days, rating, review_count, latitude, longitude, offers_ppi')
        .eq('role', 'mechanic')
        .eq('subscription_active', true);
      data = second.data;
    }
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
    const allowed = ['booked', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled', 'pending', 'quoted'];
    if (!bookingId || !allowed.includes(status)) return res.status(400).json({ error: 'bookingId and a valid status are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Enforce billing_start_date: mechanic cannot accept jobs before their billing starts
    if (status === 'accepted' || status === 'in_progress') {
      const { data: booking } = await supabase.from('bookings').select('mechanic_id').eq('id', bookingId).single();
      if (booking?.mechanic_id) {
        const { data: profile } = await supabase.from('profiles').select('billing_start_date').eq('id', booking.mechanic_id).single();
        if (profile?.billing_start_date) {
          const startDate = new Date(profile.billing_start_date);
          startDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (startDate > today) {
            const fmt = startDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
            return res.status(403).json({ error: `Your subscription has not yet started. You can accept jobs from ${fmt}.` });
          }
        }
      }
    }

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

    const serviceIds: string[] = bookingData.serviceIds || [];
    const hasDiag = serviceIds.includes('diag_inspection');
    const hasNonDiag = serviceIds.some((s: string) => s !== 'diag_inspection');

    const baseFields = {
      customer_id: userId || null,
      mechanic_id: bookingData.mechanicId,
      vehicle_rego: bookingData.vehicleId || null,
      status: bookingData.status || 'booked',
      payment_status: bookingData.paymentStatus || 'pending_payment',
      payment_method: bookingData.paymentMethod || null,
      date: bookingData.date || null,
      total_price: bookingData.totalPrice || 0,
      deposit_paid: bookingData.depositPaid ?? null,
      customer_name: bookingData.customerName || null,
      email: bookingData.email || null,
      description: bookingData.description || null,
    };

    if (hasDiag && hasNonDiag) {
      const diagId = bookingData.id;
      const repairId = crypto.randomUUID();
      const diagPrice = 99;
      const repairPrice = Math.max(0, (bookingData.totalPrice || 0) - diagPrice);
      const { error: e1 } = await supabase.from('bookings').upsert({ ...baseFields, id: diagId, service_ids: ['diag_inspection'], total_price: diagPrice, transaction_id: diagId }, { onConflict: 'id' });
      if (e1) return res.status(500).json({ error: e1.message });
      const { error: e2 } = await supabase.from('bookings').upsert({ ...baseFields, id: repairId, service_ids: serviceIds.filter((s: string) => s !== 'diag_inspection'), total_price: repairPrice, transaction_id: diagId }, { onConflict: 'id' });
      if (e2) return res.status(500).json({ error: e2.message });
    } else {
      const { error } = await supabase.from('bookings').upsert({ ...baseFields, id: bookingData.id, service_ids: serviceIds }, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: error.message });
    }

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

// GET /api/platform/stats — live platform stats for the landing page
app.get('/api/platform/stats', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ avgLow: 1059, avgHigh: 1185, bookingsCount: 0 });
    const { data: prices } = await supabase
      .from('bookings')
      .select('total_price, quoted_price')
      .eq('payment_status', 'confirmed')
      .not('total_price', 'is', null);
    const vals = (prices || []).map((r: any) => parseFloat(r.quoted_price || r.total_price)).filter((v: number) => v > 50 && v < 20000);
    if (vals.length < 5) return res.json({ avgLow: 1059, avgHigh: 1185, bookingsCount: vals.length });
    const sorted = [...vals].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    res.json({ avgLow: Math.round(p25), avgHigh: Math.round(p75), bookingsCount: vals.length });
  } catch {
    res.json({ avgLow: 1059, avgHigh: 1185, bookingsCount: 0 });
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

    // Enrich each booking with mechanic profile data so the customer portal PDF is accurate
    const bookings = data ?? [];
    const mechIds = [...new Set(bookings.map((b: any) => b.mechanic_id).filter(Boolean))];
    let mechMap: Record<string, any> = {};
    if (mechIds.length) {
      const { data: mechs } = await supabase
        .from('profiles')
        .select('id, name, address, phone, email, cancellation_notice_hours, cancellation_partial_refund_pct, labour_rate')
        .in('id', mechIds);
      (mechs ?? []).forEach((m: any) => { mechMap[m.id] = m; });
    }
    const enriched = bookings.map((b: any) => {
      const m = mechMap[b.mechanic_id] || {};
      return {
        ...b,
        transaction_id: b.transaction_id || null,
        mechanic_name: m.name || null,
        mechanic_address: m.address || null,
        mechanic_phone: m.phone || null,
        mechanic_email: m.email || null,
        cancellation_notice_hours: m.cancellation_notice_hours ?? 24,
        cancellation_partial_refund_pct: m.cancellation_partial_refund_pct ?? 50,
      };
    });
    res.json({ bookings: enriched });
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
      supabase.from('bookings').select('id, service_ids, quote_items, status, payment_status, total_price, date, created_at, mechanic_id, completed_at, mileage_out')
        .eq('vehicle_rego', rego).order('created_at', { ascending: false }),
    ]);
    // Resolve workshop names so completed-job history shows who did the work.
    const jobsList = jobs ?? [];
    const mechIds = [...new Set(jobsList.map((j: any) => j.mechanic_id).filter(Boolean))];
    let mechNames: Record<string, string> = {};
    if (mechIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', mechIds);
      mechNames = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.name]));
    }
    const enriched = jobsList.map((j: any) => ({ ...j, mechanic_name: mechNames[j.mechanic_id] || 'Torqued workshop' }));
    res.json({ imported: imported ?? [], jobs: enriched });
  } catch (err) {
    console.error('[history]', err);
    res.json({ imported: [], jobs: [] });
  }
});

// ── Mechanic Parts Inventory (CRUD via service-role — bypasses RLS) ──────────
// GET /api/mechanic/parts?mechanicId=
app.get('/api/mechanic/parts', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ parts: [] });
    const { data, error } = await supabase
      .from('mechanic_parts').select('*').eq('mechanic_id', mechanicId).order('name');
    if (error) throw error;
    res.json({ parts: data ?? [] });
  } catch (err) {
    console.error('[mechanic/parts GET]', err);
    res.json({ parts: [] });
  }
});

// POST /api/mechanic/parts — create a part
app.post('/api/mechanic/parts', async (req, res) => {
  try {
    const { mechanicId, name, quantity, unitPrice, description, minStockLevel } = req.body;
    if (!mechanicId || !name) return res.status(400).json({ error: 'mechanicId and name required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const id = crypto.randomUUID();
    const { data, error } = await supabase.from('mechanic_parts').insert({
      id, mechanic_id: mechanicId, name: String(name).trim(),
      quantity: Number(quantity) || 0,
      unit_price: parseFloat(unitPrice) || 0,
      description: description ?? null,
      min_stock_level: minStockLevel ?? null,
    }).select().single();
    if (error) throw error;
    res.json({ part: data });
  } catch (err: any) {
    console.error('[mechanic/parts POST]', err);
    res.status(500).json({ error: err?.message || 'Failed to save part' });
  }
});

// PATCH /api/mechanic/parts/:id — update quantity/price/description
app.patch('/api/mechanic/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mechanicId, quantity, unitPrice, description, minStockLevel } = req.body;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const updates: any = {};
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (unitPrice !== undefined) updates.unit_price = parseFloat(unitPrice);
    if (description !== undefined) updates.description = description;
    if (minStockLevel !== undefined) updates.min_stock_level = minStockLevel;
    const { data, error } = await supabase.from('mechanic_parts')
      .update(updates).eq('id', id).eq('mechanic_id', mechanicId).select().single();
    if (error) throw error;
    res.json({ part: data });
  } catch (err: any) {
    console.error('[mechanic/parts PATCH]', err);
    res.status(500).json({ error: err?.message || 'Failed to update part' });
  }
});

// DELETE /api/mechanic/parts/:id
app.delete('/api/mechanic/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mechanicId = req.query.mechanicId as string;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'DB unavailable' });
    const { error } = await supabase.from('mechanic_parts')
      .delete().eq('id', id).eq('mechanic_id', mechanicId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[mechanic/parts DELETE]', err);
    res.status(500).json({ error: err?.message || 'Failed to delete part' });
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

// POST /api/mechanic/update-customer — a workshop edits a customer's contact details.
// The mechanic-customers list is aggregated from bookings, so we update this mechanic's
// bookings for the customer's vehicles AND the linked customer profile so edits stick.
app.post('/api/mechanic/update-customer', async (req, res) => {
  try {
    const { mechanicId, regos, oldEmail, oldPhone, name, email, phone } = req.body;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const regoList: string[] = Array.isArray(regos) ? regos.map((r: string) => String(r).toUpperCase().trim()).filter(Boolean) : [];

    // Build the patch for booking rows (note: bookings use customer_phone, not phone).
    const bookingPatch: Record<string, any> = {};
    if (typeof name === 'string') bookingPatch.customer_name = name.trim();
    if (typeof email === 'string' && email.trim()) bookingPatch.email = email.trim();
    if (typeof phone === 'string') bookingPatch.customer_phone = phone.trim();
    if (Object.keys(bookingPatch).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    // Update this mechanic's bookings matching the customer's vehicles.
    if (regoList.length) {
      await supabase.from('bookings').update(bookingPatch).eq('mechanic_id', mechanicId).in('vehicle_rego', regoList);
    }
    // Also catch bookings matched by the customer's previous email/phone (e.g. no rego).
    if (oldEmail) await supabase.from('bookings').update(bookingPatch).eq('mechanic_id', mechanicId).eq('email', oldEmail);
    if (oldPhone) await supabase.from('bookings').update(bookingPatch).eq('mechanic_id', mechanicId).eq('customer_phone', oldPhone);

    // Propagate to the customer's profile (resolved via any of their vehicles).
    let ownerId: string | null = null;
    for (const rego of regoList) {
      const { data: v } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).maybeSingle();
      if (v?.owner_id) { ownerId = v.owner_id; break; }
    }
    if (ownerId) {
      const profilePatch: Record<string, any> = {};
      if (typeof name === 'string') profilePatch.name = name.trim();
      if (typeof email === 'string' && email.trim()) profilePatch.email = email.trim();
      if (typeof phone === 'string') profilePatch.phone = phone.trim();
      if (Object.keys(profilePatch).length) {
        await supabase.from('profiles').update(profilePatch).eq('id', ownerId);
        if (profilePatch.email) { try { await supabase.auth.admin.updateUserById(ownerId, { email: profilePatch.email }); } catch {} }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/update-customer]', err);
    res.status(500).json({ error: 'Could not update customer' });
  }
});

// GET /api/mechanic/profile?mechanicId= — fetch mechanic profile via admin client (bypasses RLS)
app.get('/api/mechanic/profile', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });
    // Try the full select; if a newer column (e.g. offers_ppi pre-migration) is missing,
    // fall back to the core columns so the profile NEVER fails to load.
    let { data, error } = await supabase
      .from('profiles')
      .select('name, phone, address, nzbn, service_areas, diagnostic_tools, certifications, labour_rate, shop_fee, banner_image, technicians, parts_lead_days, billing_start_date, cancellation_notice_hours, cancellation_partial_refund_pct, offers_ppi')
      .eq('id', mechanicId)
      .single();
    if (error) {
      console.warn('[mechanic/profile] full select failed, falling back:', error.message);
      ({ data, error } = await supabase
        .from('profiles')
        .select('name, phone, address, nzbn, service_areas, diagnostic_tools, certifications, labour_rate, shop_fee, banner_image, technicians, parts_lead_days')
        .eq('id', mechanicId)
        .single());
      if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ profile: data ?? null });
  } catch (err) {
    console.error('[mechanic/profile]', err);
    res.status(500).json({ error: 'Server error' });
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
    const jobs = data ?? [];
    // Enrich with vehicle data (year, make, model, mileage) for use in quote PDFs and display
    const uniqueRegos = [...new Set(jobs.map((j: any) => j.vehicle_rego).filter(Boolean))] as string[];
    if (uniqueRegos.length) {
      const { data: vehicles } = await supabase.from('vehicles')
        .select('rego, make, model, year, mileage').in('rego', uniqueRegos);
      const vehicleMap: Record<string, any> = {};
      (vehicles ?? []).forEach((v: any) => { vehicleMap[v.rego] = v; });
      jobs.forEach((j: any) => {
        const v = vehicleMap[j.vehicle_rego];
        if (v) {
          j.vehicle_make = v.make || null;
          j.vehicle_model = v.model || null;
          j.vehicle_year = v.year || null;
          j.vehicle_mileage = v.mileage || null;
          const yearStr = v.year ? `${v.year} ` : '';
          j.vehicle_label = v.make ? `${yearStr}${v.make} ${v.model || ''}`.trim() : j.vehicle_rego;
        }
      });
    }
    res.json({ jobs });
  } catch (err) {
    console.error('[mechanic/jobs]', err);
    res.json({ jobs: [] });
  }
});

// POST /api/customer/save-profile — save name/location/email for customer portal users (uses admin key, bypasses RLS)
app.post('/api/customer/save-profile', async (req, res) => {
  const { email, ownerId, name, homeLocation, email_update } = req.body as Record<string, string>;
  if (!email && !ownerId) return res.json({ ok: false });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ ok: false });
    const fields: Record<string, any> = {};
    if (name !== undefined) fields.name = name;
    if (homeLocation !== undefined) fields.home_location = homeLocation;
    if (email_update && email_update.trim() && email_update !== email) fields.email = email_update.trim();
    if (Object.keys(fields).length === 0) return res.json({ ok: true });
    let error: any = null;
    if (ownerId) {
      // Prefer upsert so the row is created if it doesn't exist yet
      const upsertRow = { id: ownerId, ...(email ? { email } : {}), ...fields };
      ({ error } = await supabase.from('profiles').upsert(upsertRow, { onConflict: 'id', ignoreDuplicates: false }));
    } else {
      ({ error } = await (supabase.from('profiles').update(fields) as any).ilike('email', email.trim()));
    }
    if (error) { console.error('[save-profile]', error.message); return res.json({ ok: false, error: error.message }); }
    // Also update Supabase auth email if changed
    if (fields.email && ownerId) {
      try { await supabase.auth.admin.updateUserById(ownerId, { email: fields.email }); } catch {}
    }
    res.json({ ok: true });
  } catch (err) { console.error('[save-profile]', err); res.json({ ok: false }); }
});

// GET /api/customer/ppi-report?rego= — most recent completed PPI inspection for a vehicle
app.get('/api/customer/ppi-report', async (req, res) => {
  const rego = String(req.query.rego || '').toUpperCase().trim();
  if (!rego) return res.json({ ppi: null });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ ppi: null });
    const { data } = await supabase.from('ppi_inspections')
      .select('*')
      .eq('rego', rego)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    res.json({ ppi: data || null });
  } catch { res.json({ ppi: null }); }
});

// GET /api/mechanic/customer-lookup?mechanicId=&rego= — most recent customer info for a rego
app.get('/api/mechanic/customer-lookup', async (req, res) => {
  const { mechanicId, rego } = req.query as Record<string, string>;
  if (!mechanicId || !rego) return res.json({ customer: null });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ customer: null });
    const { data } = await supabase
      .from('bookings')
      .select('customer_name, email, customer_phone, mileage_in')
      .eq('mechanic_id', mechanicId)
      .ilike('vehicle_rego', rego.trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return res.json({ customer: data || null });
  } catch { return res.json({ customer: null }); }
});

// ── Passkeys (WebAuthn) ─────────────────────────────────────
const RP_ID = 'torqued-psi.vercel.app';
const RP_ORIGIN = 'https://torqued-psi.vercel.app';
const RP_NAME = 'Torqued';

// GET /api/passkey/has — does this actor already have a passkey registered?
app.get('/api/passkey/has', async (req, res) => {
  try {
    const actorType = req.query.actorType as string;
    const ownerRef = req.query.ownerRef as string;
    if (!actorType || !ownerRef) return res.json({ has: false });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ has: false });
    const { data } = await supabase.from('webauthn_credentials')
      .select('credential_id').eq('actor_type', actorType).eq('owner_ref', String(ownerRef).toLowerCase()).limit(1);
    res.json({ has: !!(data && data.length) });
  } catch { res.json({ has: false }); }
});

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
    const reqOrigin = getOrigin(req);
    const verification = await verifyRegistrationResponse({
      response, expectedChallenge: data.challenge,
      expectedOrigin: reqOrigin && reqOrigin !== RP_ORIGIN ? [RP_ORIGIN, reqOrigin] : RP_ORIGIN,
      expectedRPID: RP_ID,
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
    // Best-effort: store device label — silently skipped if device_name column doesn't exist yet
    try {
      const ua = req.headers['user-agent'] || '';
      const deviceName = parseUADeviceName(ua);
      if (deviceName) {
        await supabase.from('webauthn_credentials')
          .update({ device_name: deviceName } as any)
          .eq('credential_id', cred.id)
          .eq('owner_ref', String(data.ownerRef).toLowerCase());
      }
    } catch { /* column not yet added — ignore */ }
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
    const authReqOrigin = getOrigin(req);
    const verification = await verifyAuthenticationResponse({
      response, expectedChallenge: data.challenge,
      expectedOrigin: authReqOrigin && authReqOrigin !== RP_ORIGIN ? [RP_ORIGIN, authReqOrigin] : RP_ORIGIN,
      expectedRPID: RP_ID,
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
    // customer: owner_ref is now the customer's email address (supports multiple vehicles)
    // Legacy: if owner_ref looks like a rego (no @), fall back to rego-based lookup
    let email: string | null = null, ownerId: string | null = null, vehicles: any[] = [], rego: string = '';
    const ownerRef = cred.owner_ref as string;
    if (ownerRef.includes('@')) {
      // Email-keyed passkey — look up profile by email
      const { data: profile } = await supabase.from('profiles').select('id, email').ilike('email', ownerRef).maybeSingle();
      if (profile) {
        ownerId = profile.id;
        email = profile.email;
        const { data: rows } = await supabase.from('vehicles').select('rego, make, model, year, variant, mileage, thumbnail').eq('owner_id', ownerId);
        vehicles = rows ?? [];
        rego = vehicles[0]?.rego ?? '';
      }
    } else {
      // Legacy rego-keyed passkey — resolve via vehicle
      rego = ownerRef.toUpperCase();
      const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
      if (vehicle?.owner_id) {
        ownerId = vehicle.owner_id;
        const { data: p } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
        email = p?.email ?? null;
        const { data: rows } = await supabase.from('vehicles').select('rego, make, model, year, variant, mileage, thumbnail').eq('owner_id', ownerId);
        vehicles = rows ?? [];
        rego = vehicles[0]?.rego ?? rego;
      }
    }
    // vt: short-lived signed token so the native app can complete sign-in after web passkey auth
    res.json({ success: true, actorType: 'customer', rego, email, ownerId, vehicles, vt: rego ? makeMagicToken(rego) : null });
  } catch (err) {
    console.error('[passkey/auth-verify]', err);
    res.status(500).json({ error: 'Sign-in failed' });
  }
});

// GET /api/passkey/list — list all passkeys for a given actor
app.get('/api/passkey/list', async (req, res) => {
  try {
    const { actorType, ownerRef } = req.query as { actorType: string; ownerRef: string };
    if (!actorType || !ownerRef) return res.status(400).json({ error: 'Missing actorType or ownerRef' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    let rows: any[] | null = null;
    const q1 = await supabase.from('webauthn_credentials')
      .select('id, credential_id, created_at, transports, device_name')
      .eq('actor_type', actorType)
      .eq('owner_ref', String(ownerRef).toLowerCase())
      .order('created_at', { ascending: false });
    if (!q1.error) {
      rows = q1.data;
    } else {
      // device_name column not yet added — fall back without it
      const q2 = await supabase.from('webauthn_credentials')
        .select('id, credential_id, created_at, transports')
        .eq('actor_type', actorType)
        .eq('owner_ref', String(ownerRef).toLowerCase())
        .order('created_at', { ascending: false });
      if (q2.error) return res.status(500).json({ error: q2.error.message });
      rows = q2.data;
    }
    res.json({ passkeys: rows || [] });
  } catch (err) {
    console.error('[passkey/list]', err);
    res.status(500).json({ error: 'Could not list passkeys' });
  }
});

// DELETE /api/passkey/delete — remove a specific passkey by row id
app.delete('/api/passkey/delete', async (req, res) => {
  try {
    const { id, actorType, ownerRef } = req.body;
    if (!id || !actorType || !ownerRef) return res.status(400).json({ error: 'Missing fields' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { error } = await supabase.from('webauthn_credentials')
      .delete()
      .eq('id', id)
      .eq('actor_type', actorType)
      .eq('owner_ref', String(ownerRef).toLowerCase());
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[passkey/delete]', err);
    res.status(500).json({ error: 'Could not delete passkey' });
  }
});

// ── Carjam ABCD API helper ───────────────────────────────────────────────────
// Shared vehicle data shape — used by FuelSaver (active) and CarJam (archived).
// CarJam implementation: archive/carjam/carjam-api.ts
interface CarjamVehicle {
  make: string;
  model: string;
  year: number;
  variant: string;
  vin: string | null;
  engineCc: number | null;
  transmissionType: string | null;
  fuelType: string | null;
  stolenFlag: boolean;
  latestOdometer: number | null;
  power: number | null;             // kW
  rawMake: string;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Calls the FuelSaver (NZ govt) API and normalises the response into the same CarjamVehicle shape.
// Only fields relevant to vehicle identification are mapped; emissions/cost fields are ignored.
async function callFuelSaverAPI(plate: string): Promise<CarjamVehicle | null> {
  const login = process.env.FUELSAVER_LOGIN;
  if (!login) return null;
  try {
    const params = JSON.stringify({ api: 'labels', listingid: plate, login, plate });
    const url = `https://resources.fuelsaver.govt.nz/api/?params=${encodeURIComponent(params)}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'TorquedNZ/1.0 (torquedappnz@gmail.com)' },
    });
    if (!resp.ok) return null;
    const d = await resp.json() as any;
    if (d?.ErrorCode !== 0 || !d?.Make) return null;
    const year = d.mvrYear ? parseInt(String(d.mvrYear), 10) : new Date().getFullYear();
    return {
      make: titleCase(String(d.Make)),
      model: String(d.Model || ''),
      year,
      variant: String(d.SubModel || '').trim(),
      vin: null,
      engineCc: d.EngineSize ? parseInt(String(d.EngineSize), 10) || null : null,
      transmissionType: d.Transmission ? String(d.Transmission) : null,
      fuelType: d.FuelType ? String(d.FuelType) : null,
      stolenFlag: false,
      latestOdometer: null,
      power: d.EnginePower ? parseInt(String(d.EnginePower), 10) || null : null,
      rawMake: String(d.Make).toUpperCase(),
    };
  } catch (err: any) {
    console.warn('[fuelsaver] lookup failed:', err?.message);
    return null;
  }
}

// Active lookup — FuelSaver only. CarJam is archived (archive/carjam/carjam-api.ts).
async function lookupPlateData(plate: string): Promise<CarjamVehicle | null> {
  return callFuelSaverAPI(plate);
}

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

    if (!vehicle) {
      // Plate not in our DB — try CarJam then FuelSaver to identify the vehicle
      const carjam = await lookupPlateData(formattedRego);
      if (!carjam) {
        return res.status(404).json({ error: 'Plate not found in our registry', notFound: true });
      }

      // Try to match against vehicle_models for engine/parts spec
      let vehicleModelMatch: any = null;
      if (supabase) {
        const firstWord = carjam.model.split(' ')[0];
        const tryVMQuery = async (modelPat: string, withYear: boolean) => {
          let q = supabase.from('vehicle_models')
            .select('id, make, model, submodel, engine_code, engine_cc, fuel, transmission, timing_drive, year_from, year_to')
            .ilike('make', `%${carjam.rawMake}%`)
            .ilike('model', modelPat);
          if (withYear && carjam.year) {
            q = q.lte('year_from', carjam.year).or(`year_to.is.null,year_to.gte.${carjam.year}`);
          }
          // Prefer row with closest cc_rating if available
          if (carjam.engineCc) {
            q = q.order('engine_cc', { ascending: true });
          }
          const { data } = await q.limit(8);
          return (data as any[]) ?? [];
        };

        let rows = await tryVMQuery(`%${carjam.model}%`, true);
        if (!rows.length && firstWord !== carjam.model) rows = await tryVMQuery(`%${firstWord}%`, true);
        if (!rows.length) rows = await tryVMQuery(`%${carjam.model}%`, false);
        if (!rows.length && firstWord !== carjam.model) rows = await tryVMQuery(`%${firstWord}%`, false);

        // Pick the closest engine_cc match if we have cc data
        if (rows.length && carjam.engineCc) {
          rows.sort((a: any, b: any) => {
            const diffA = Math.abs((a.engine_cc || 0) - (carjam.engineCc as number));
            const diffB = Math.abs((b.engine_cc || 0) - (carjam.engineCc as number));
            return diffA - diffB;
          });
          vehicleModelMatch = rows[0];
        } else if (rows.length === 1) {
          vehicleModelMatch = rows[0];
        } else if (rows.length > 1) {
          // Return all options for picker (set vehicleModelMatch to array)
          vehicleModelMatch = rows;
        }
      }

      return res.json({
        found: true,
        isNew: true,
        carjamData: carjam,
        vehicleModelMatch,
      });
    }

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

    // Returning customer — send a 6-digit verification code (DB-backed, Vercel-safe)
    const code = crypto.randomInt(100000, 999999).toString();
    await supabase.from('customer_otps').upsert({
      rego: formattedRego, code_hash: hashOtp(code), email: ownerEmail,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), attempts: 0,
    }, { onConflict: 'rego' });
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: ownerEmail,
        subject: `${code} is your Torqued verification code`,
        html: generateOtpEmailHtml(formattedRego, code),
      }).catch(e => console.warn('[check-plate] OTP email failed:', e?.message));
    }
    return res.json({
      found: true, isNew: false, customerName,
      maskedEmail: maskEmail(ownerEmail), codeSent: true,
    });
  } catch (err) {
    console.error('[check-plate]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rego/carjam — ARCHIVED. CarJam is disabled; use /api/rego/fuelsaver or /api/rego/lookup.
// Implementation preserved in archive/carjam/carjam-api.ts.
app.get('/api/rego/carjam', (_req, res) => {
  res.status(410).json({ error: 'CarJam integration is archived. Use /api/rego/lookup instead.' });
});

// GET /api/rego/fuelsaver?plate=ABC123 — FuelSaver label lookup (NZ govt, free)
app.get('/api/rego/fuelsaver', async (req, res) => {
  const plate = String(req.query.plate || '').toUpperCase().trim();
  if (!plate) return res.status(400).json({ error: 'plate required' });
  const data = await callFuelSaverAPI(plate);
  if (!data) return res.status(404).json({ error: 'Vehicle not found via FuelSaver' });
  res.json(data);
});

// GET /api/rego/lookup?plate=ABC123 — tries CarJam then FuelSaver, returns first match
app.get('/api/rego/lookup', async (req, res) => {
  const plate = String(req.query.plate || '').toUpperCase().trim();
  if (!plate) return res.status(400).json({ error: 'plate required' });
  const data = await lookupPlateData(plate);
  if (!data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
});

// GET /api/vehicles/lookup?make=xxx&model=xxx&year=xxx — fuzzy search vehicle_models for manual entry matching
app.get('/api/vehicles/lookup', async (req, res) => {
  try {
    const make  = String(req.query.make  || '').trim();
    const model = String(req.query.model || '').trim();
    const year  = Number(req.query.year)  || null;
    if (!make || !model) return res.status(400).json({ error: 'make and model are required' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const firstWord = model.split(' ')[0];

    // Try progressively looser matches: exact → prefix → no year
    const tryQuery = async (modelPat: string, withYear: boolean) => {
      let q = supabase.from('vehicle_models')
        .select('id, make, model, submodel, engine_code, engine_cc, fuel, transmission, drive, year_from, year_to, timing_drive, body_type')
        .ilike('make', `%${make}%`)
        .ilike('model', modelPat);
      if (withYear && year) {
        q = q.lte('year_from', year).or(`year_to.is.null,year_to.gte.${year}`);
      }
      const { data } = await q.order('year_from', { ascending: false }).limit(8);
      return (data as any[]) ?? [];
    };

    let rows = await tryQuery(`%${model}%`, true);
    if (!rows.length) rows = await tryQuery(`%${firstWord}%`, true);
    if (!rows.length) rows = await tryQuery(`%${model}%`, false);
    if (!rows.length) rows = await tryQuery(`%${firstWord}%`, false);

    res.json({ results: rows });
  } catch (err) {
    console.error('[vehicles/lookup]', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// POST /api/customer/manual-vehicle — create a vehicles row from manually-entered details
// when the customer's plate can't be found via the automated registry lookup.
// If vehicleModelId is provided, also writes a vehicle_aliases row so fleet-prices can resolve engine data.
app.post('/api/customer/manual-vehicle', async (req, res) => {
  try {
    const { rego, year, make, model, submodel, vehicleModelId } = req.body;
    if (!rego || !make || !model) return res.status(400).json({ error: 'rego, make and model are required' });
    const formattedRego = String(rego).toUpperCase().trim();
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Check if already exists (idempotent)
    const { data: existing } = await supabase
      .from('vehicles').select('rego, owner_id').eq('rego', formattedRego).single();

    if (existing) {
      return res.json({ found: true, isNew: !existing.owner_id });
    }

    const cleanMake    = String(make).trim();
    const cleanModel   = String(model).trim();
    const cleanSubmodel = submodel ? String(submodel).trim() : null;
    const numYear      = year ? Number(year) : null;

    // Insert manually-entered vehicle
    const { error: insertErr } = await supabase.from('vehicles').insert({
      rego: formattedRego,
      year: numYear,
      make: cleanMake,
      model: cleanModel,
      variant: cleanSubmodel,
    });
    if (insertErr) {
      console.error('[manual-vehicle] insert error:', insertErr);
      return res.status(500).json({ error: 'Could not register vehicle' });
    }

    // If a vehicle_models match was selected, create an alias so fleet-prices resolves correctly
    if (vehicleModelId) {
      const { error: aliasErr } = await supabase.from('vehicle_aliases').upsert({
        vehicle_id:    vehicleModelId,
        alias_make:    cleanMake,
        alias_model:   cleanModel,
        alias_variant: cleanSubmodel,
        year_from:     numYear,
        year_to:       numYear,
      }, { onConflict: 'alias_make,alias_model,alias_variant,year_from,engine_code' });
      if (aliasErr) console.warn('[manual-vehicle] alias upsert warning:', aliasErr.message);
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
<p style="font-size:13px;color:rgba(255,255,255,.7)">Log in at <a href="https://torqued-psi.vercel.app/mechanic" style="color:#FF1800">torqued-psi.vercel.app/mechanic</a>, enter <strong>sritorqued</strong> in the promo field on the activation screen, and click Apply — your Garage Hub unlocks instantly.</p>
<a href="https://torqued-psi.vercel.app/mechanic" style="display:inline-block;background:#FF1800;color:#fff;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:8px">Open Mechanic Portal</a>
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
  const ctx = { custName: '', email: '', custPhone: '', rego: '', vehicleLabel: '', mileage: null as number | null, mechanicName: '', mechanicEmail: '' };
  const supabase = getSupabaseAdmin();
  if (!supabase || !bookingId) return ctx;
  const { data: b } = await supabase.from('bookings').select('email, customer_name, customer_phone, customer_id, vehicle_rego, mechanic_id').eq('id', bookingId).single();
  if (!b) return ctx;
  ctx.custName = b.customer_name || ''; ctx.email = b.email || ''; ctx.custPhone = b.customer_phone || ''; ctx.rego = b.vehicle_rego || '';
  if (b.vehicle_rego) {
    const { data: v } = await supabase.from('vehicles').select('make, model, year, mileage, owner_id').eq('rego', b.vehicle_rego).single();
    const yearStr = v?.year ? `${v.year} ` : '';
    ctx.vehicleLabel = v?.make ? `${yearStr}${v.make} ${v.model || ''} (${b.vehicle_rego})`.trim() : `(${b.vehicle_rego})`;
    ctx.mileage = v?.mileage ? Number(v.mileage) : null;
    // Backfill the customer's real name/email from their profile so emails address them by name (never "Dear Customer").
    if (!ctx.custName || !ctx.email) {
      const ownerId = b.customer_id || v?.owner_id;
      if (ownerId) {
        const { data: p } = await supabase.from('profiles').select('name, email, phone').eq('id', ownerId).single();
        if (!ctx.custName) ctx.custName = p?.name || '';
        if (!ctx.email) ctx.email = p?.email || '';
        if (!ctx.custPhone) ctx.custPhone = p?.phone || '';
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
  timing: 'Cambelt', transmission: 'DCT Transmission Service',
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
  const link = `https://torqued-psi.vercel.app/customer?quote=${encodeURIComponent(bookingId)}`;
  return emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Your quote is ready')}
${emailGreeting(custName)}
${emailPara(`Thanks for booking with Torqued. Your quote for your <strong>${car}</strong>${mech} is ready to view.`)}
${emailPara(`We offer a wide range of flexible payment options to suit your budget.`)}
<a href="${link}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_TITLE_FONT};font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:12px;">View your quote</a>
${emailPara(`<span style="color:#999;">Kind regards,<br/>The Torqued team</span>`)}
</td></tr>`);
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
    const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle(`Message from ${ctx.mechanicName || 'your workshop'}`)}
${emailGreeting(ctx.custName)}
<p style="margin:0 0 8px;font-family:${EMAIL_BODY_FONT};font-size:11px;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Regarding ${car}</p>
<div style="margin:0 0 20px;padding:16px;background:#f7f7f9;border-radius:12px;border-left:3px solid ${EMAIL_RED};font-family:${EMAIL_BODY_FONT};font-size:14px;line-height:1.6;color:#374151;">${safeMsg}</div>
${emailPara(`Reply to this email to respond directly.`)}
${emailPara(`<span style="color:#999;">Kind regards,<br/>${ctx.mechanicName || 'Your workshop'} via Torqued</span>`)}
</td></tr>`);
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
    const { bookingId, amount, reason } = req.body; // amount optional (full if omitted)
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
      type: 'refund', amount: refundedDollars, mechanic_id: booking.mechanic_id, booking_id: bookingId,
      note: reason ? `Stripe refund — ${reason}` : 'Stripe refund',
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
      const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('How was your service?')}
${emailPara(`Thanks for booking your <strong>${vehicleLabel}</strong> with Torqued. Your feedback helps other Kiwis find a trusted mechanic.`)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f7f4f0;border-radius:12px;border:1px solid #e8e4df;">
  <tr><td style="padding:20px 18px;text-align:center;">
    <p style="margin:0 0 14px;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">Rate your experience with <strong>${mechName}</strong></p>
    <a href="${reviewUrl}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Leave a Review</a>
  </td></tr>
</table>
</td></tr>`);
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
    const link = `https://torqued-psi.vercel.app/admin?setup=${token}`;
    const transporter = getMailTransporter();
    if (transporter) {
      const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Create Your Admin Password')}
${emailPara("You've been granted admin access to the Torqued back-office. Set your own secure password using the button below — it's never shared.")}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td>
    <a href="${link}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Create Password</a>
  </td></tr>
</table>
${emailPara(`Link expires in 24 hours. Or paste: <a href="${link}" style="color:${EMAIL_MUTED};word-break:break-all;font-size:11px;">${link}</a>`)}
</td></tr>`);
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
    const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Admin Portal Access')}
${emailPara("You've been granted admin access to the Torqued back-office.")}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f7f4f0;border-radius:12px;border:1px solid #e8e4df;">
  <tr><td style="padding:16px 18px;">
    <p style="margin:0 0 8px;font-family:${EMAIL_BODY_FONT};font-size:13px;color:${EMAIL_DARK};"><strong>Portal:</strong> <a href="https://torqued-psi.vercel.app/admin" style="color:${EMAIL_RED};">torqued-psi.vercel.app/admin</a></p>
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:13px;color:${EMAIL_DARK};"><strong>Temporary password:</strong> <span style="font-family:monospace;">${tempPass}</span></p>
  </td></tr>
</table>
<div style="background:#fff7e6;border:1px solid #ffe2a8;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
  <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:13px;color:#7a5b00;"><strong>Action required:</strong> please set a strong personal password — do not keep the temporary one.</p>
</div>
<a href="https://torqued-psi.vercel.app/admin" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Open Admin Portal</a>
</td></tr>`);

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
    const allowed = ['name','email','phone','role','subscription_active','address','nzbn','labour_rate','technicians','parts_lead_days','wof_disabled'];
    const update: Record<string, any> = {};
    for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    let { error } = await supabase.from('profiles').update(update).eq('id', id);
    if (error && /wof_disabled/.test(error.message || '')) {
      return res.status(500).json({ error: 'The wof_disabled column is missing — run roster-schema.sql in Supabase first.' });
    }
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
  // Prefer the richer onboarding fields, but degrade gracefully if a column is
  // missing (e.g. migration 028 not yet applied) so the list never comes back empty.
  const rich = await supabase.from('profiles')
    .select('id, name, email, address, subscription_active, onboarding_complete, agreement_signed_at, billing_start_date, rating, review_count, created_at')
    .eq('role', 'mechanic').order('created_at', { ascending: false });
  let mechanics: any[] = rich.data ?? [];
  if (rich.error) {
    console.warn('[admin/mechanics] rich select failed, falling back:', rich.error.message);
    const basic = await supabase.from('profiles')
      .select('id, name, email, address, subscription_active, onboarding_complete, rating, review_count, created_at')
      .eq('role', 'mechanic').order('created_at', { ascending: false });
    mechanics = basic.data ?? [];
  }
  res.json({ mechanics });
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
    const resetLink = buildResetLink(origin, email);
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: 'Reset your Torqued password',
        html: emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Reset Your Password')}
${emailPara('A password reset was requested for your Torqued account.')}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td>
    <a href="${resetLink}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Reset Password</a>
  </td></tr>
</table>
${emailPara(`If you didn't request this, you can ignore this email.`)}
</td></tr>`),
      }).catch(e => console.warn('Reset email failed (non-blocking):', e?.message));
    }
    res.json({ success: true, resetLink });
  } catch (err) {
    console.error('[admin/reset-password]', err);
    res.status(500).json({ error: 'Could not send reset' });
  }
});

// POST /api/mechanic/forgot-password — self-service reset. Public, but only emails
// existing mechanic/admin accounts. Always returns success so we never reveal whether
// an email is registered.
app.post('/api/mechanic/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: profile } = await supabase.from('profiles').select('id, role').eq('email', email).maybeSingle();
    // Don't leak account existence — pretend success if there's no match.
    if (!profile) return res.json({ success: true });
    const origin = getOrigin(req);
    // Self-contained signed reset link — does NOT depend on Supabase's redirect allowlist,
    // so it reliably lands on our own set-password page instead of the plain login screen.
    const resetLink = buildResetLink(origin, email);
    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: 'Reset your Torqued password',
        html: emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Reset Your Password')}
${emailPara('We received a request to reset the password for your Torqued workshop account. Tap below to choose a new one — the link expires in 1 hour.')}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td>
    <a href="${resetLink}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Set a new password</a>
  </td></tr>
</table>
${emailPara(`If you didn't request this, you can safely ignore this email.`)}
</td></tr>`),
      }).catch(e => console.warn('Reset email failed (non-blocking):', e?.message));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/forgot-password]', err);
    res.status(500).json({ error: 'Could not send reset link' });
  }
});

// Build a signed 1-hour reset link to our own set-password page.
function buildResetLink(origin: string, email: string): string {
  const token = signAdmin({ kind: 'pw-reset', email: String(email).toLowerCase() }, 60 * 60 * 1000);
  return `${origin}/mechanic?reset_token=${encodeURIComponent(token)}`;
}

// POST /api/auth/set-password — verify a signed reset/onboarding token and set the password.
app.post('/api/auth/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const data = readSigned(token);
    if (!data || data.kind !== 'pw-reset' || !data.email) return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', String(data.email).toLowerCase()).maybeSingle();
    if (!profile?.id) return res.status(404).json({ error: 'Account not found.' });
    const { error } = await supabase.auth.admin.updateUserById(profile.id, { password: String(password), email_confirm: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, email: data.email });
  } catch (err) {
    console.error('[auth/set-password]', err);
    res.status(500).json({ error: 'Could not set password' });
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

// POST /api/admin/apply-promo — apply free months or a percentage discount to a mechanic's subscription
app.post('/api/admin/apply-promo', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { mechanicId, promoType, months, percent } = req.body;
  if (!mechanicId || !promoType) return res.status(400).json({ error: 'mechanicId and promoType required' });
  if (!['free_months', 'percent_off'].includes(promoType)) return res.status(400).json({ error: 'promoType must be free_months or percent_off' });
  const numMonths = parseInt(months, 10);
  if (!numMonths || numMonths < 1 || numMonths > 24) return res.status(400).json({ error: 'months must be 1–24' });
  const numPercent = promoType === 'percent_off' ? parseInt(percent, 10) : 100;
  if (promoType === 'percent_off' && (!numPercent || numPercent < 1 || numPercent > 99)) return res.status(400).json({ error: 'percent must be 1–99' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const stripe = getStripe();
  if (!stripe) {
    await supabase.from('profiles').update({ subscription_active: true }).eq('id', mechanicId);
    return res.json({ success: true, message: 'Stripe not configured — activated in DB only' });
  }

  const { data: profile } = await supabase.from('profiles').select('id, email, name, stripe_subscription_id').eq('id', mechanicId).single();
  if (!profile) return res.status(404).json({ error: 'Mechanic not found' });

  try {
    const couponName = promoType === 'free_months'
      ? `Torqued Admin – ${numMonths} free month${numMonths > 1 ? 's' : ''}`
      : `Torqued Admin – ${numPercent}% off ${numMonths} month${numMonths > 1 ? 's' : ''}`;

    const coupon = await stripe.coupons.create({
      percent_off: numPercent,
      duration: 'repeating',
      duration_in_months: numMonths,
      name: couponName,
    });

    let message: string;

    if (profile.stripe_subscription_id) {
      // Apply coupon to existing subscription
      await (stripe.subscriptions as any).update(profile.stripe_subscription_id, { coupon: coupon.id });
      await supabase.from('profiles').update({ subscription_active: true }).eq('id', mechanicId);
      message = promoType === 'free_months'
        ? `Applied ${numMonths} free month${numMonths > 1 ? 's' : ''} to existing subscription`
        : `Applied ${numPercent}% off for ${numMonths} month${numMonths > 1 ? 's' : ''} to existing subscription`;
    } else {
      // No subscription yet — create one with a free trial (for testing without a card on file)
      // The coupon is attached for post-trial billing (for percent_off); for free_months it's 100% off
      const existing = await stripe.customers.list({ email: profile.email, limit: 1 });
      const customerId = existing.data.length > 0
        ? existing.data[0].id
        : (await stripe.customers.create({ email: profile.email, name: profile.name || undefined, metadata: { mechanicId } })).id;

      const price = await stripe.prices.create({
        currency: 'nzd',
        unit_amount: 9900,
        recurring: { interval: 'month' },
        product_data: { name: 'Torqued Garage Portal Subscription' },
      });

      const sub = await (stripe.subscriptions as any).create({
        customer: customerId,
        items: [{ price: price.id }],
        coupon: coupon.id,
        trial_period_days: numMonths * 30,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
      });

      await supabase.from('profiles').update({ stripe_subscription_id: sub.id, subscription_active: true }).eq('id', mechanicId);
      message = promoType === 'free_months'
        ? `Created subscription with ${numMonths}-month trial — activated, no card required`
        : `Created subscription with ${numPercent}% off + ${numMonths}-month trial — activated, card needed at renewal`;
    }

    res.json({ success: true, message });
  } catch (err: any) {
    console.error('[admin/apply-promo]', err);
    res.status(500).json({ error: err?.message || 'Could not apply promo' });
  }
});

// POST /api/admin/upload-document — upload a document for a mechanic (base64 JSON approach)
app.post('/api/admin/upload-document', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { mechanicId, fileBase64, fileName, mimeType, description } = req.body;
    if (!mechanicId || !fileBase64 || !fileName) return res.status(400).json({ error: 'mechanicId, fileBase64, and fileName are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const storagePath = `${mechanicId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    // Ensure bucket exists
    await supabase.storage.createBucket('mechanic-documents', { public: false }).catch(() => {});
    const { error: uploadError } = await supabase.storage.from('mechanic-documents').upload(storagePath, fileBuffer, { contentType: mimeType || 'application/octet-stream', upsert: false });
    if (uploadError) return res.status(500).json({ error: uploadError.message });
    const { data: urlData } = supabase.storage.from('mechanic-documents').getPublicUrl(storagePath);
    const fileUrl = urlData?.publicUrl || storagePath;
    const { data: doc, error: dbError } = await supabase.from('mechanic_documents').insert({ mechanic_id: mechanicId, file_name: fileName, file_url: fileUrl, description: description || null }).select().single();
    if (dbError) return res.status(500).json({ error: dbError.message });
    res.json({ url: fileUrl, id: doc?.id });
  } catch (err) {
    console.error('[admin/upload-document]', err);
    res.status(500).json({ error: 'Could not upload document' });
  }
});

// GET /api/admin/documents/:mechanicId — list documents for a mechanic
app.get('/api/admin/documents/:mechanicId', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { mechanicId } = req.params;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data, error } = await supabase.from('mechanic_documents').select('*').eq('mechanic_id', mechanicId).order('uploaded_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ documents: data || [] });
  } catch (err) {
    console.error('[admin/documents]', err);
    res.status(500).json({ error: 'Could not fetch documents' });
  }
});

// POST /api/admin/document-request — ask a workshop to email in documents, and log the ask.
// Documents arrive via the Torqued inbox (the email asks them to reply); nothing is uploaded here.
app.post('/api/admin/document-request', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { mechanicId, description } = req.body;
    if (!mechanicId || !description || !String(description).trim()) {
      return res.status(400).json({ error: 'mechanicId and a document description are required' });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', mechanicId).maybeSingle();
    if (!profile?.email) return res.status(404).json({ error: 'No email on file for this workshop' });

    const { data: row, error: dbError } = await supabase.from('mechanic_document_requests')
      .insert({ mechanic_id: mechanicId, description: String(description).trim(), status: 'pending' })
      .select().single();
    if (dbError) return res.status(500).json({ error: dbError.message });

    const transporter = getMailTransporter();
    if (transporter) {
      const docsHtml = String(description).trim().split('\n').filter(Boolean)
        .map(line => `<li style="margin:0 0 6px;font-family:${EMAIL_BODY_FONT};font-size:14px;color:${EMAIL_DARK};">${line.replace(/^[-•]\s*/, '')}</li>`)
        .join('');
      const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('A quick document request')}
<p style="margin:0 0 14px;font-family:${EMAIL_BODY_FONT};font-size:15px;color:${EMAIL_DARK};">Kia ora ${profile.name || 'there'},</p>
${emailPara("So we can get you on Torqued soon, please reply to this email with the following documents:")}
<ul style="margin:8px 0 18px;padding-left:20px;">${docsHtml}</ul>
${emailPara("Just hit reply and attach them — our team will take care of the rest. Ngā mihi, The Torqued Team.")}
</td></tr>`);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: profile.email,
        subject: 'Torqued — documents needed to get you set up',
        html,
      }).catch(e => console.warn('Doc request email failed (non-blocking):', e?.message));
    }
    res.json({ success: true, request: row });
  } catch (err) {
    console.error('[admin/document-request]', err);
    res.status(500).json({ error: 'Could not send document request' });
  }
});

// GET /api/admin/document-requests/:mechanicId — list document requests for a workshop
app.get('/api/admin/document-requests/:mechanicId', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data, error } = await supabase.from('mechanic_document_requests')
      .select('*').eq('mechanic_id', req.params.mechanicId).order('requested_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ requests: data || [] });
  } catch (err) {
    console.error('[admin/document-requests]', err);
    res.status(500).json({ error: 'Could not fetch document requests' });
  }
});

// POST /api/admin/document-request-update — mark resolved / unresolved and set an internal comment
app.post('/api/admin/document-request-update', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { id, status, internal_comment } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const update: Record<string, any> = {};
    if (status === 'pending' || status === 'resolved') {
      update.status = status;
      update.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
    }
    if (internal_comment !== undefined) update.internal_comment = internal_comment;
    const { data, error } = await supabase.from('mechanic_document_requests').update(update).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, request: data });
  } catch (err) {
    console.error('[admin/document-request-update]', err);
    res.status(500).json({ error: 'Could not update document request' });
  }
});

// POST /api/admin/onboard-mechanic — a Torqued employee onboards a workshop directly
app.post('/api/admin/onboard-mechanic', async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { email, name, legal_name, address, phone, labour_rate, technicians, parts_lead_days, owner_name, owner_phone, nzbn, years_in_trade, billing_start_date } = req.body;
    // billing: 'stripe' | 'half3months' (50% off 3 months) | 'trial' | 'comp'
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
    const startDate = billing_start_date || null;
    await supabase.from('profiles').upsert({
      id: userId, email, name, role: 'mechanic',
      legal_name: legal_name || null,
      address: address || null, phone: phone || null, owner_name: owner_name || null, owner_phone: owner_phone || null,
      nzbn: nzbn || null, years_in_trade: years_in_trade ? Number(years_in_trade) : null,
      labour_rate: labour_rate != null && labour_rate !== '' ? Number(labour_rate) : null,
      technicians: technicians != null && technicians !== '' ? Number(technicians) : 1,
      parts_lead_days: parts_lead_days != null && parts_lead_days !== '' ? Number(parts_lead_days) : 1,
      billing_start_date: startDate,
      latitude, longitude,
      subscription_active: compActivate,
      onboarding_complete: true,
    }, { onConflict: 'id' });

    // Build the Stripe subscription checkout link (unless comped)
    let billingLink = '';
    if (!compActivate) {
      const effectiveTrialDays = billing === 'trial' ? (trialDays || 30) : 0;
      const sub = await makeSubscriptionCheckout(email, userId, origin, billing === 'half3months' ? 'half3months' : effectiveTrialDays);
      billingLink = sub.url || '';
    }

    // Self-contained signed link so step 1 ("Set your password") reliably lands on our
    // own set-password page (no dependency on Supabase's redirect allowlist).
    const setPasswordLink = buildResetLink(origin, email);
    const loginLink = `${origin}/mechanic`;

    const transporter = getMailTransporter();
    const billingLabel = billing === 'half3months' ? '$49.50/mo for 3 months, then $99/mo'
      : billing === 'trial' ? `free for ${trialDays || 30} days then $99/mo`
      : '$99/mo';
    if (transporter) {
      // Numbered onboarding checklist. Steps adapt to billing (comp accounts skip Stripe).
      const stepBtn = (href: string, label: string, dark = false) =>
        `<a href="${href}" style="display:inline-block;background:${dark ? EMAIL_DARK : EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:11px 22px;border-radius:9px;">${label}</a>`;
      const step = (n: number, title: string, body: string) =>
        `<tr><td style="padding:0 0 18px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td valign="top" style="width:30px;"><div style="width:24px;height:24px;border-radius:50%;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-align:center;line-height:24px;">${n}</div></td>
            <td valign="top" style="padding-left:10px;">
              <p style="margin:0 0 6px;font-family:${EMAIL_BODY_FONT};font-size:14px;font-weight:800;color:${EMAIL_DARK};">${title}</p>
              ${body}
            </td>
          </tr></table>
        </td></tr>`;

      const steps: string[] = [];
      steps.push(step(1, 'Set your password',
        `<p style="margin:0 0 9px;font-family:${EMAIL_BODY_FONT};font-size:13px;color:#555;">Choose a secure password and you'll be taken straight into your portal.</p>${stepBtn(setPasswordLink, 'Set my password')}`));
      if (!compActivate) {
        steps.push(step(2, 'Activate your subscription',
          `<p style="margin:0 0 9px;font-family:${EMAIL_BODY_FONT};font-size:13px;color:#555;">${billingLabel}. ${startDate ? `Your listing goes live on <strong>${startDate}</strong>.` : 'This puts your workshop live to receive leads.'}</p>${stepBtn(billingLink || `${origin}/mechanic`, 'Set up Stripe billing')}`));
      }
      const contractStepNo = compActivate ? 2 : 3;
      steps.push(step(contractStepNo, 'Sign your onboarding contract',
        `<p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:13px;color:#555;">Review and sign your Torqued onboarding contract in your portal — it appears automatically after you log in.</p>`));
      steps.push(step(contractStepNo + 1, "Log in — you're ready to go",
        `<p style="margin:0 0 9px;font-family:${EMAIL_BODY_FONT};font-size:13px;color:#555;">Set your services, hours and rates, then start accepting jobs.</p>${stepBtn(loginLink, 'Open my portal', true)}`));

      const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Welcome to Torqued')}
${emailGreeting(name)}
${emailPara("Your workshop account is ready. Here are the few steps to get you live on Torqued — the NZ repair marketplace:")}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
${steps.join('\n')}
</table>
${emailPara('Need a hand? Just reply to this email and our team will help you get set up.')}
</td></tr>`);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: email,
        subject: 'Welcome to Torqued — 4 steps to go live',
        html,
      }).catch(e => console.warn('Onboard email failed (non-blocking):', e?.message));
    }

    res.json({ success: true, mechanicId: userId, loginLink, setPasswordLink, billingLink, activated: compActivate });
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

    const allowed = ['name','legal_name','nzbn','address','phone','owner_name','owner_phone','years_in_trade','bio','bank_account_name','bank_account_number','labour_rate','shop_fee','technicians','parts_lead_days','service_areas','diagnostic_tools','certifications','banner_image','cancellation_notice_hours','cancellation_partial_refund_pct','billing_start_date','agreement_signed_at','agreement_signed_by','offers_ppi'];
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
    // Pre-migration 034: offers_ppi column may not exist yet — retry without it.
    if (error && /offers_ppi/.test(error.message || '')) {
      delete update.offers_ppi;
      ({ error } = await supabase.from('profiles').update(update).eq('id', mechanicId));
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[save-onboarding]', err);
    res.status(500).json({ error: 'Could not save' });
  }
});

// POST /api/mechanic/email-contract — email the signed partnership agreement PDF to the mechanic
app.post('/api/mechanic/email-contract', async (req, res) => {
  try {
    const { mechanicId, pdfBase64, email, workshopName } = req.body;
    if (!mechanicId || !pdfBase64 || !email) return res.status(400).json({ error: 'mechanicId, pdfBase64, and email are required' });
    const transporter = getMailTransporter();
    if (!transporter) {
      console.log('[email-contract] Mail transporter not configured — skipping email');
      return res.json({ sent: false, reason: 'mail_not_configured' });
    }
    const html = emailWrap(`
      <tr><td style="padding:36px 32px;">
        ${emailTitle('Your Torqued Onboarding Contract')}
        ${emailGreeting(workshopName || null)}
        ${emailPara('Thank you for joining the Torqued platform. Your signed onboarding contract is attached to this email. Please keep it for your records.')}
        ${emailPara(`If you have any questions about the contract, please contact us at <a href="mailto:torquedapp.nz@gmail.com" style="color:${EMAIL_RED};font-weight:700;">torquedapp.nz@gmail.com</a>.`)}
        ${emailPara('We look forward to working with you.')}
      </td></tr>
    `);
    await transporter.sendMail({
      from: `"Torqued" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Torqued Onboarding Contract',
      html,
      attachments: [{
        filename: 'Torqued-Onboarding-Contract.pdf',
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      }],
    });
    res.json({ sent: true });
  } catch (err) {
    console.error('[email-contract]', err);
    res.status(500).json({ error: 'Could not send contract email' });
  }
});

// POST /api/mechanic/send-email-otp — send a 6-digit OTP to the mechanic's workshop email
app.post('/api/mechanic/send-email-otp', async (req, res) => {
  try {
    const { email, mechanicId } = req.body;
    if (!email || !mechanicId) return res.status(400).json({ error: 'email and mechanicId are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    // Delete any existing codes for this mechanic/email
    await supabase.from('mechanic_email_verifications').delete().eq('mechanic_id', mechanicId).eq('email', email);
    await supabase.from('mechanic_email_verifications').insert({ mechanic_id: mechanicId, email, code, expires_at: expiresAt });
    const transporter = getMailTransporter();
    if (transporter) {
      const html = emailWrap(`
        <tr><td style="padding:36px 32px;text-align:center;">
          <span style="display:inline-block;background:rgba(255,24,0,.08);color:${EMAIL_RED};font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 12px;border-radius:6px;font-family:${EMAIL_BODY_FONT};">EMAIL VERIFICATION</span>
          <div style="margin:18px 0 0;">${emailTitle('Your Verification Code')}</div>
          ${emailGreeting(null)}
          ${emailPara('Use the code below to verify your workshop email address. This code expires in 15 minutes.')}
          <div style="margin:24px 0;font-family:${EMAIL_TITLE_FONT};font-size:36px;font-weight:900;letter-spacing:8px;color:${EMAIL_DARK};">${code}</div>
          ${emailPara('If you did not request this code, please ignore this email.')}
        </td></tr>
      `);
      await transporter.sendMail({
        from: `"Torqued" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your Torqued Verification Code',
        html,
      });
    } else {
      console.warn('[send-email-otp] Mail not configured — verification email not sent.');
    }
    res.json({ sent: true });
  } catch (err) {
    console.error('[send-email-otp]', err);
    res.status(500).json({ error: 'Could not send OTP' });
  }
});

// POST /api/mechanic/verify-email-otp — verify the 6-digit OTP
app.post('/api/mechanic/verify-email-otp', async (req, res) => {
  try {
    const { email, code, mechanicId } = req.body;
    if (!email || !code || !mechanicId) return res.status(400).json({ error: 'email, code, and mechanicId are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data } = await supabase.from('mechanic_email_verifications')
      .select('*').eq('mechanic_id', mechanicId).eq('email', email).eq('code', code)
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!data) return res.json({ verified: false, error: 'Invalid or expired code' });
    // Delete the used code
    await supabase.from('mechanic_email_verifications').delete().eq('id', data.id);
    // Update profile with verified workshop email
    await supabase.from('profiles').update({ workshop_email: email, workshop_email_verified: true }).eq('id', mechanicId);
    res.json({ verified: true });
  } catch (err) {
    console.error('[verify-email-otp]', err);
    res.status(500).json({ error: 'Verification failed' });
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

// POST /api/mechanic/update-address — geocode a mechanic's address via Nominatim and update lat/lng
app.post('/api/mechanic/update-address', async (req, res) => {
  try {
    const { mechanicId, address } = req.body;
    if (!mechanicId || !address) return res.status(400).json({ error: 'mechanicId and address required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Geocode via Nominatim
    const encoded = encodeURIComponent(address);
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=nz&limit=1&q=${encoded}`,
      { headers: { 'User-Agent': 'TorquedNZ/1.0 (torquedapp.nz@gmail.com)' } }
    );
    const geoData = await geoRes.json();
    const lat = geoData[0] ? parseFloat(geoData[0].lat) : null;
    const lng = geoData[0] ? parseFloat(geoData[0].lon) : null;

    const { error } = await supabase
      .from('profiles')
      .update({ address, latitude: lat, longitude: lng })
      .eq('id', mechanicId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, latitude: lat, longitude: lng });
  } catch (err) {
    console.error('[mechanic/update-address]', err);
    res.status(500).json({ error: 'Could not update address' });
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
      console.warn('[Mechanic resend link] Mail not configured — login link not sent.');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/resend]', err);
    res.status(500).json({ error: 'Failed to resend link' });
  }
});

// ── AI insight in-memory cache ───────────────────────────────────────────────
// Key: `${rego}|${mileage}|${histCount}`, TTL: 7 days.
// Prevents redundant Claude calls when nothing about the vehicle has changed.
const _aiInsightCache = new Map<string, { insights: any[]; hasHistory: boolean; ts: number }>();
const AI_INSIGHT_TTL = 7 * 24 * 60 * 60 * 1000;

// ── Claude (Anthropic) AI helpers ───────────────────────────────────────────
// All AI calls now use claude-haiku-4-5 with web search enabled.
const CLAUDE_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_HEADERS = (apiKey: string, webSearch = false) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  ...(webSearch ? { 'anthropic-beta': 'web-search-2025-03-05' } : {}),
});

// Converts OpenAI-style content arrays (image_url, file) to Anthropic format.
function toAnthropicContent(content: any): any[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [{ type: 'text', text: String(content) }];
  return content.map((block: any) => {
    if (block.type === 'text') return block;
    if (block.type === 'image_url') {
      const url: string = block.image_url?.url ?? '';
      const mediaType = url.match(/^data:(image\/[a-z+]+);base64,/)?.[1] ?? 'image/jpeg';
      const data = url.replace(/^data:[^,]+;base64,/, '');
      return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
    }
    if (block.type === 'file') {
      const raw: string = block.file?.file_data ?? '';
      const data = raw.replace(/^data:[^,]+;base64,/, '');
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
    }
    return block;
  });
}

// Simple one-shot Claude call — vision-capable (images & PDFs), no web search.
// Used for receipt parsing and single-prompt tasks.
async function callClaude(content: any, jsonMode = false): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const body: any = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: toAnthropicContent(content) }],
  };
  if (jsonMode) body.system = 'Return only valid JSON. No markdown code fences, no explanation.';
  const r = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: ANTHROPIC_HEADERS(apiKey),
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Claude request failed');
  return data.content?.[0]?.text ?? '';
}

// Chat-style Claude call — system prompt + multi-turn conversation + web search.
// Messages may include { role, content, image } for vision. System messages are
// extracted and passed as the top-level `system` field (Anthropic requirement).
async function callClaudeChat(messages: any[], maxTokens = 500, jsonMode = false, webSearch = true): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  // Extract system message and build system prompt
  const systemMsg = messages.find((m: any) => m.role === 'system');
  const convMsgs  = messages.filter((m: any) => m.role !== 'system');
  let systemPrompt = (systemMsg?.content ?? systemMsg?.text ?? '') as string;
  if (jsonMode) systemPrompt += '\nRespond ONLY with valid JSON. No code fences, no explanatory text.';

  // Expand image attachments to Claude vision format
  const expanded = convMsgs.map((m: any) => {
    const text = (m.content ?? m.text ?? '') as string;
    if (!m.image) return { role: m.role, content: text };
    const raw = String(m.image);
    const base64 = raw.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaType = raw.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    return {
      role: m.role,
      content: [
        { type: 'text', text },
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      ],
    };
  });

  // Merge consecutive same-role messages (Claude requires strict user/assistant alternation)
  const normalised: any[] = [];
  for (const msg of expanded) {
    const last = normalised[normalised.length - 1];
    if (last?.role === msg.role && typeof last.content === 'string' && typeof msg.content === 'string') {
      last.content += '\n' + msg.content;
    } else {
      normalised.push({ ...msg });
    }
  }
  if (normalised.length === 0 || normalised[0].role !== 'user') {
    normalised.unshift({ role: 'user', content: '...' });
  }

  const body: any = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: normalised,
  };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  if (systemPrompt) body.system = systemPrompt;

  const r = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: ANTHROPIC_HEADERS(apiKey, webSearch),
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Claude request failed');

  // Collect all text blocks (web_search may insert result blocks before the final answer)
  const text = ((data.content as any[]) ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text as string)
    .join('');
  return text;
}

// POST /api/ai/mechanic-assistant — mechanic data chat with full DB access.
app.post('/api/ai/mechanic-assistant', async (req, res) => {
  try {
    const { messages, vehicle, rego, mechanicId } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI assistant not configured (add Anthropic API key).' });

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
    const reply = await callClaudeChat([sys, ...normalised], 600);
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
    // vehicleModelId can be passed directly when the customer has confirmed their exact variant
    const vehicleModelIdParam = req.query.vehicleModelId ? String(req.query.vehicleModelId) : null;
    if (!rego && !vehicleModelIdParam) return res.json({ prices: {} });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ prices: {} });

    const mechanicId = req.query.mechanic ? String(req.query.mechanic) : null;
    const PLATFORM_LABOUR_FALLBACK = 130;

    let vmRows: any[] | null = null;
    let custVehicle: { make?: string; model?: string; year?: number } = {};

    if (vehicleModelIdParam) {
      // Fast path — customer confirmed their exact variant, skip the fuzzy lookup
      const { data: vm } = await supabase
        .from('vehicle_models')
        .select('id, timing_drive, make, model')
        .eq('id', vehicleModelIdParam)
        .single();
      if (vm) {
        vmRows = [vm];
        custVehicle = { make: vm.make, model: vm.model };
      }
    }

    if (!vmRows?.length) {
      if (!rego) return res.json({ prices: {}, timingDrive: null, vehicleId: null });

      // 1. Resolve make/model/year from the customer's vehicle record
      const { data: cv } = await supabase
        .from('vehicles').select('make, model, year').eq('rego', rego).single();
      if (!cv?.make) return res.json({ prices: {}, timingDrive: null, vehicleId: null });
      custVehicle = cv;

      // 2. Match vehicle_models — four-tier fallback
      const firstWord = String(cv.model).split(' ')[0];
      const queryVM = async (modelPat: string, withYear: boolean) => {
        let q = (supabase as any)
          .from('vehicle_models')
          .select('id, timing_drive')
          .ilike('make', cv.make)
          .ilike('model', modelPat);
        if (withYear && cv.year) {
          q = q.lte('year_from', cv.year)
               .or(`year_to.is.null,year_to.gte.${cv.year}`);
        }
        const { data } = await q.limit(1);
        return data as any[] | null;
      };

      vmRows = await queryVM(cv.model, true);
      if (!vmRows?.length && firstWord !== cv.model)
        vmRows = await queryVM(firstWord + '%', true);
      if (!vmRows?.length)
        vmRows = await queryVM(cv.model, false);
      if (!vmRows?.length && firstWord !== cv.model)
        vmRows = await queryVM(firstWord + '%', false);
    }

    if (!vmRows?.length) {
      // ── Try engine-family path via fleet_vehicles → ef_parts_data ──────────
      if (custVehicle.make) {
        const fvFirstWord = String(custVehicle.model || '').split(' ')[0];
        const queryFV = async (modelPat: string, withYear: boolean) => {
          let q = (supabase as any).from('fleet_vehicles')
            .select('engine_family_id')
            .ilike('make', custVehicle.make!)
            .ilike('model', modelPat);
          if (withYear && custVehicle.year)
            q = q.lte('year_from', custVehicle.year).or(`year_to.is.null,year_to.gte.${custVehicle.year}`);
          const { data } = await q.limit(1);
          return data as any[] | null;
        };
        let fvRows = await queryFV(String(custVehicle.model || ''), true);
        if (!fvRows?.length && fvFirstWord !== custVehicle.model)
          fvRows = await queryFV(fvFirstWord + '%', true);
        if (!fvRows?.length)
          fvRows = await queryFV(String(custVehicle.model || ''), false);
        if (!fvRows?.length && fvFirstWord !== custVehicle.model)
          fvRows = await queryFV(fvFirstWord + '%', false);

        if (fvRows?.length) {
          const efFamilyId: string = fvRows[0].engine_family_id;

          const [efFamilyRes, efPartsRes, efRateRes] = await Promise.all([
            supabase.from('engine_families')
              .select('timing_type, oil_capacity_l, oil_spec, segment_tier')
              .eq('family_id', efFamilyId).single(),
            (supabase as any).from('ef_parts_data')
              .select('total_job_low, total_job_high, hours_low, hours_high, part_categories(slug)')
              .eq('engine_family_id', efFamilyId),
            mechanicId
              ? supabase.from('profiles').select('labour_rate, shop_fee').eq('id', mechanicId).maybeSingle()
              : supabase.from('profiles').select('labour_rate').eq('role', 'mechanic').eq('subscription_active', true).not('labour_rate', 'is', null),
          ]);

          const ef = efFamilyRes.data as any;
          const efParts = (efPartsRes.data ?? []) as any[];

          let efLabourRate: number;
          if (mechanicId) {
            efLabourRate = Number((efRateRes as any).data?.labour_rate) || PLATFORM_LABOUR_FALLBACK;
          } else {
            const rates = ((efRateRes as any).data as any[] | null) ?? [];
            const valid = rates.map((r: any) => Number(r.labour_rate)).filter(n => n > 0);
            efLabourRate = valid.length
              ? Math.round(valid.reduce((a: number, b: number) => a + b, 0) / valid.length)
              : PLATFORM_LABOUR_FALLBACK;
          }
          const efShopFee = mechanicId ? (Number((efRateRes as any).data?.shop_fee) || null) : null;

          const EF_SLUG_TO_SVC: Record<string, string> = {
            'brake_pads_front':            'brakes_front_pads',
            'brake_pads_rear':             'brakes_rear_pads',
            'brake_pads_and_rotors_front': 'brakes_front_rotors',
            'basic_service':               'oil',
            'comprehensive_service':       'full',
            'cambelt_full':                'timing',
            'wet_belt_replacement':        'timing',
            'timing_chain_replacement':    'timing',
          };

          const efPrices: Record<string, any> = {};
          for (const row of efParts) {
            const slug = (row.part_categories as any)?.slug as string | undefined;
            if (!slug) continue;
            const svcId = EF_SLUG_TO_SVC[slug];
            if (!svcId || efPrices[svcId]) continue; // first match wins

            // ef_parts_data totals are already GST-inclusive NZD
            const low  = Number(row.total_job_low);
            const high = Number(row.total_job_high);
            const hh   = Number(row.hours_high) || 0;
            const chargedHrs = Math.ceil(hh * 4) / 4;
            const labour = chargedHrs > 0 ? Math.round(chargedHrs * efLabourRate) : 0;
            const hrsLabel = chargedHrs > 0 ? String(chargedHrs % 1 === 0 ? chargedHrs.toFixed(0) : chargedHrs.toFixed(2).replace(/0+$/, '')) : null;

            efPrices[svcId] = {
              low, high, midpoint: Math.round((low + high) / 2),
              partsLow: Math.max(0, low - labour), partsHigh: Math.max(0, high - labour),
              labourLow: labour, labourHigh: labour, labourHours: hrsLabel,
              fromEngineFamily: true,
            };

            // Brake pad floor: 2.25hrs minimum
            if (svcId === 'brakes_front_pads' || svcId === 'brakes_rear_pads') {
              const bpLabour = Math.round(2.25 * efLabourRate);
              efPrices[svcId].labourLow  = bpLabour;
              efPrices[svcId].labourHigh = bpLabour;
              efPrices[svcId].labourHours = '2.25';
              efPrices[svcId].partsLow  = Math.max(0, low - bpLabour);
              efPrices[svcId].partsHigh = Math.max(0, high - bpLabour);
            }

            // Annotate service jobs with oil info from engine_family
            if ((slug === 'basic_service' || slug === 'comprehensive_service') && ef) {
              efPrices[svcId].oilType = ef.oil_spec || null;
              efPrices[svcId].oilCapacityL = ef.oil_capacity_l || null;
            }
          }

          // Fixed-price services
          if (!efPrices['wof'])
            efPrices['wof'] = { low: 55, high: 75, midpoint: 65, partsLow: 0, partsHigh: 0, labourLow: 65, labourHigh: 65, labourHours: '0.5' };
          if (!efPrices['diag_inspection'])
            efPrices['diag_inspection'] = { low: 99, high: 99, midpoint: 99, partsLow: 0, partsHigh: 0, labourLow: 99, labourHigh: 99, labourHours: '1' };
          if (!efPrices['ppi'])
            efPrices['ppi'] = { low: 199, high: 199, midpoint: 199, partsLow: 0, partsHigh: 0, labourLow: 199, labourHigh: 199, labourHours: '2' };

          // Brake fluid fallback
          if (!efPrices['brake_fluid']) {
            const bfLabour = Math.round(0.75 * efLabourRate);
            efPrices['brake_fluid'] = { low: 25 + bfLabour, high: 45 + bfLabour, midpoint: 35 + bfLabour,
              partsLow: 25, partsHigh: 45, labourLow: bfLabour, labourHigh: bfLabour, labourHours: '0.75',
              fluidType: 'DOT 4', fluidCapacityL: 0.5, fluidCostHigh: 45, sundries: 5 };
          }

          // Coolant flush fallback
          if (!efPrices['coolant_flush']) {
            const cfL = 5.0;
            const cfLabour = Math.round(1.0 * efLabourRate);
            const cfFluidLow = Math.round(cfL * 9), cfFluidHigh = Math.round(cfL * 17);
            efPrices['coolant_flush'] = { low: cfFluidLow + cfLabour, high: cfFluidHigh + cfLabour,
              midpoint: Math.round((cfFluidLow + cfFluidHigh) / 2) + cfLabour,
              partsLow: cfFluidLow, partsHigh: cfFluidHigh,
              labourLow: cfLabour, labourHigh: cfLabour, labourHours: '1',
              fluidType: 'OAT Coolant', fluidCapacityL: cfL, sundries: 10 };
          }

          // Timing drive from engine_family timing_type
          const efTimingDrive = ef?.timing_type === 'chain' ? 'chain'
            : (ef?.timing_type === 'belt' || ef?.timing_type === 'wet_belt') ? 'belt'
            : null;

          // Chain timing fallback if no ef_parts_data timing row
          if (!efPrices['timing'] && efTimingDrive === 'chain') {
            const tcLabour = Math.round(5.0 * efLabourRate);
            efPrices['timing'] = { low: 600 + tcLabour, high: 1100 + tcLabour,
              midpoint: 850 + tcLabour, partsLow: 600, partsHigh: 1100,
              labourLow: tcLabour, labourHigh: tcLabour, labourHours: '5', indicative: true };
          }

          // Water pump fallback
          if (!efPrices['water_pump']) {
            const wpLabour = Math.round(2.0 * efLabourRate);
            efPrices['water_pump'] = { low: 320 + 120 + 45 + wpLabour, high: 480 + 180 + 85 + wpLabour,
              midpoint: 400 + 150 + 65 + wpLabour,
              partsLow: 320 + 120 + 45, partsHigh: 480 + 180 + 85,
              labourLow: wpLabour, labourHigh: wpLabour, labourHours: '2',
              coolantLow: 45, coolantHigh: 85 };
          }

          const wpMakesEF = ['volkswagen', 'vw', 'skoda', 'seat', 'audi', 'volvo', 'land rover', 'jaguar'];
          const efWPRec = efTimingDrive === 'belt'
            && wpMakesEF.some(m => (custVehicle.make || '').toLowerCase().includes(m));
          const wpEFLabour = Math.round(1.0 * efLabourRate);

          return res.json({
            prices: efPrices,
            timingDrive: efTimingDrive,
            vehicleId: null,
            shopFee: efShopFee,
            vehicleOilType: ef?.oil_spec || '',
            waterPumpRecommended: efWPRec,
            waterPumpInDB: efTimingDrive != null,
            waterPump: efWPRec ? {
              partsLow: 435, partsHigh: 660, coolantLow: 60, coolantHigh: 90,
              labourExtra: wpEFLabour,
              low: 435 + 60 + wpEFLabour, high: 660 + 90 + wpEFLabour,
            } : null,
            fromEngineFamily: true,
            engineFamilyId: efFamilyId,
          });
        }
      }

      // ── No vehicle_models OR fleet_vehicles match — try timing drive from vehicle_specs
      const { data: specFallback } = await supabase.from('vehicle_specs')
        .select('cambelt_or_chain').eq('rego', rego).maybeSingle();
      let fallbackTimingDrive: string | null = null;
      if (specFallback?.cambelt_or_chain) {
        const raw = String(specFallback.cambelt_or_chain).toLowerCase();
        if (raw.includes('belt')) fallbackTimingDrive = 'belt';
        else if (raw.includes('chain')) fallbackTimingDrive = 'chain';
        else fallbackTimingDrive = 'na';
      }
      const wpMakes = ['volkswagen', 'vw', 'skoda', 'seat', 'audi'];
      const wpRec = fallbackTimingDrive === 'belt' &&
        wpMakes.some(m => (custVehicle.make || '').toLowerCase().includes(m));
      const wpLabourFallback = Math.round(1.0 * 130);
      return res.json({
        prices: {}, timingDrive: fallbackTimingDrive, vehicleId: null,
        waterPumpRecommended: wpRec,
        waterPump: wpRec ? { partsLow: 280, partsHigh: 420, labourExtra: wpLabourFallback,
          low: 280 + wpLabourFallback, high: 420 + wpLabourFallback } : null,
      });
    }
    const vehicleId: string = vmRows[0].id;
    let timingDrive: string | null = vmRows[0].timing_drive ?? null;

    // 3. Fetch all relevant category IDs in one query
    const slugs = Object.values(FLEET_SERVICE_TO_SLUG);
    const { data: cats } = await supabase
      .from('part_categories').select('id, slug').in('slug', slugs);
    if (!cats || cats.length === 0) {
      const wpMakes2 = ['volkswagen', 'vw', 'skoda', 'seat', 'audi'];
      const wpRec2 = timingDrive === 'belt' && wpMakes2.some(m => (custVehicle.make || '').toLowerCase().includes(m));
      const wpL2 = 130; // platform fallback $/hr
      return res.json({ prices: {}, timingDrive, vehicleId,
        waterPumpRecommended: wpRec2,
        waterPump: wpRec2 ? { partsLow: 280, partsHigh: 420, labourExtra: wpL2, low: 280 + wpL2, high: 420 + wpL2 } : null });
    }

    const catIdToSlug: Record<number, string> = Object.fromEntries(cats.map((c: any) => [c.id, c.slug]));
    const slugToServiceId: Record<string, string> = Object.fromEntries(
      Object.entries(FLEET_SERVICE_TO_SLUG).map(([svcId, slug]) => [slug, svcId])
    );

    const catIds = cats.map((c: any) => c.id);

    // 4. Pull parts_data + labour_times + vehicle_specs + mechanic labour rate in parallel
    // ── Pricing constants ────────────────────────────────────────────────────
    // parts_data was AI-seeded with ex-GST trade prices; multiply by 1.15 to get
    // customer-facing NZD incl. GST. Oil consumables are quoted at retail (incl. GST).
    const NZ_GST = 1.15;

    // Oil change
    const OIL_COST_PER_LITRE_LOW  = 18;  // $/L semi-synthetic NZ retail incl. GST
    const OIL_COST_PER_LITRE_HIGH = 22;  // $/L full-synthetic NZ retail incl. GST
    const OIL_CHANGE_DEFAULT_LITRES = 4.5;
    const OIL_CHANGE_SUNDRIES = 10;       // drip trays, rags, sundries (incl. GST)

    // Transmission service fixed extras (incl. GST)
    const TRANS_FREIGHT  = 10;   // freight on fluid/filter kit
    const TRANS_SUNDRIES = 10;   // gaskets, thread seal, rags
    const TRANS_SCAN_FEE = 25;   // service-light reset / TCU adaptation scan

    const [partsRes, labourRes, specRes, rateRes] = await Promise.all([
      supabase.from('parts_data')
        .select('category_id, part_cost_low, part_cost_high')
        .eq('vehicle_id', vehicleId).in('category_id', catIds),
      supabase.from('labour_times')
        .select('category_id, hours_low, hours_high')
        .eq('vehicle_id', vehicleId).in('category_id', catIds),
      supabase.from('vehicle_specs')
        .select('oil_capacity_litres, oil_type, cambelt_or_chain, transmission_fluid_type, transmission_fluid_capacity_litres, coolant_capacity_litres')
        .eq('rego', rego).maybeSingle(),
      // Fetch labour rate: specific mechanic if provided, else platform average
      mechanicId
        ? supabase.from('profiles').select('labour_rate, shop_fee').eq('id', mechanicId).maybeSingle()
        : supabase.from('profiles').select('labour_rate').eq('role', 'mechanic').eq('subscription_active', true).not('labour_rate', 'is', null),
    ]);

    // Resolve labour rate: mechanic-specific, or average of active mechanics, or fallback
    let NZD_LABOUR_RATE: number;
    if (mechanicId) {
      NZD_LABOUR_RATE = Number((rateRes as any).data?.labour_rate) || PLATFORM_LABOUR_FALLBACK;
    } else {
      const rates = ((rateRes as any).data as any[] | null) ?? [];
      const validRates = rates.map((r: any) => Number(r.labour_rate)).filter(n => n > 0);
      NZD_LABOUR_RATE = validRates.length
        ? Math.round(validRates.reduce((a: number, b: number) => a + b, 0) / validRates.length)
        : PLATFORM_LABOUR_FALLBACK;
    }

    const shopFee = mechanicId ? (Number((rateRes as any).data?.shop_fee) || null) : null;

    // Transmission fluid: resolve type then derive capacity and per-litre cost
    const transFluidTypeRaw = String(specRes.data?.transmission_fluid_type || '');
    const transFluidType = transFluidTypeRaw.toLowerCase();
    const transFluidKnown = transFluidTypeRaw.trim().length > 0;
    const isDSG = transFluidType.includes('dsg') || transFluidType.includes('dct') || transFluidType.includes('dual');
    const isCVT = transFluidType.includes('cvt');
    const isManual = transFluidType.includes('manual');

    // Capacity: use DB value if present, else fall back to type-based estimate
    const transFluidCapacityL = Number(specRes.data?.transmission_fluid_capacity_litres) ||
      (isDSG ? 5.5 : isCVT ? 6.0 : isManual ? 2.0 : 4.0);

    // Fluid cost: per-litre rate × actual capacity
    const transFluidPerLLow  = isDSG ? 25 : isCVT ? 20 : isManual ? 20 : 20;
    const transFluidPerLHigh = isDSG ? 36 : isCVT ? 30 : isManual ? 30 : 30;
    let transFluidCostLow  = Math.round(transFluidCapacityL * transFluidPerLLow);
    let transFluidCostHigh = Math.round(transFluidCapacityL * transFluidPerLHigh);
    // Floor so unknown ATF vehicles still get a sensible minimum
    if (!transFluidKnown) { transFluidCostLow = Math.max(80, transFluidCostLow); transFluidCostHigh = Math.max(120, transFluidCostHigh); }
    // Coolant capacity: use DB value if present, else default 5L
    const coolantCapacityL = Number(specRes.data?.coolant_capacity_litres) || 5.0;
    const vehicleOilType = String(specRes.data?.oil_type || '');

    const oilCapacity = Number(specRes.data?.oil_capacity_litres) || OIL_CHANGE_DEFAULT_LITRES;
    // Fall back to vehicle_specs.cambelt_or_chain if vehicle_models didn't carry timing_drive
    if (!timingDrive && specRes.data?.cambelt_or_chain) {
      const raw = String(specRes.data.cambelt_or_chain).toLowerCase();
      if (raw.includes('belt')) timingDrive = 'belt';
      else if (raw.includes('chain')) timingDrive = 'chain';
      else timingDrive = 'na';
    }

    // Index labour by category_id for O(1) lookup
    const labourByCat: Record<number, { hl: number; hh: number }> = {};
    for (const lt of (labourRes.data ?? []) as any[]) {
      labourByCat[lt.category_id] = { hl: Number(lt.hours_low), hh: Number(lt.hours_high) };
    }

    // Find special-case category ids
    const oilFilterCatId  = cats.find((c: any) => c.slug === 'oil_filter')?.id          ?? -1;
    const transCatId       = cats.find((c: any) => c.slug === 'transmission_filter')?.id ?? -1;

    const prices: Record<string, any> = {};
    for (const row of (partsRes.data ?? []) as any[]) {
      const slug = catIdToSlug[row.category_id];
      const svcId = slug ? slugToServiceId[slug] : null;
      if (!svcId) continue;

      // Apply NZ GST to ex-GST trade parts costs
      const pLow  = Math.round(Number(row.part_cost_low)  * NZ_GST);
      const pHigh = Math.round(Number(row.part_cost_high) * NZ_GST);
      const lt = labourByCat[row.category_id];

      let low: number, high: number, lLow = 0, lHigh = 0, lHours: string | null = null;

      // Round hours_high UP to nearest 0.25hr — charge the top of the range
      const roundUpQtr = (h: number) => Math.ceil(h * 4) / 4;
      const chargedHrs = lt ? roundUpQtr(lt.hh) : 0;
      const labourAmt  = chargedHrs > 0 ? Math.round(chargedHrs * NZD_LABOUR_RATE) : 0;
      const hrsLabel   = chargedHrs > 0 ? String(chargedHrs % 1 === 0 ? chargedHrs.toFixed(0) : chargedHrs.toFixed(2).replace(/0+$/, '')) : null;

      if (row.category_id === oilFilterCatId) {
        // Oil Change: oil consumables (retail incl GST) + filter (incl GST) + 1hr labour + sundries
        const oilLow  = Math.round(oilCapacity * OIL_COST_PER_LITRE_LOW);
        const oilHigh = Math.round(oilCapacity * OIL_COST_PER_LITRE_HIGH);
        lLow = lHigh = NZD_LABOUR_RATE;
        low  = oilLow  + pLow  + NZD_LABOUR_RATE + OIL_CHANGE_SUNDRIES;
        high = oilHigh + pHigh + NZD_LABOUR_RATE + OIL_CHANGE_SUNDRIES;
        lHours = '1';
        (prices as any)['_oil_detail'] = { oilType: vehicleOilType, oilCapacityL: oilCapacity, oilCostLow: oilLow, oilCostHigh: oilHigh };
      } else if (row.category_id === transCatId) {
        // Transmission Service: cap at 1.25hrs — standard drain-and-fill including TCU adaptation
        const TRANS_MAX_LABOUR_HRS = 1.25;
        const cappedHrs = Math.min(chargedHrs || TRANS_MAX_LABOUR_HRS, TRANS_MAX_LABOUR_HRS);
        const cappedLabour = Math.round(cappedHrs * NZD_LABOUR_RATE);
        const cappedLabel = String(cappedHrs % 1 === 0 ? cappedHrs.toFixed(0) : cappedHrs.toFixed(2).replace(/0+$/, ''));
        lLow = lHigh = cappedLabour;
        lHours = cappedLabel;
        const extras = TRANS_FREIGHT + TRANS_SUNDRIES + TRANS_SCAN_FEE;
        low  = pLow  + transFluidCostLow  + cappedLabour + extras;
        high = pHigh + transFluidCostHigh + cappedLabour + extras;
        // Store fluid detail for UI display
        (prices as any)['_trans_detail'] = {
          fluidType: transFluidKnown ? transFluidTypeRaw : null,
          fluidCapacityL: transFluidCapacityL,
          fluidCostLow: transFluidCostLow,
          fluidCostHigh: transFluidCostHigh,
          freight: TRANS_FREIGHT,
          sundries: TRANS_SUNDRIES,
          scanFee: TRANS_SCAN_FEE,
        };
      } else {
        // All other services: parts (incl GST) + labour (top of range, rounded up to 0.25hr)
        lLow = lHigh = labourAmt;
        lHours = hrsLabel;
        low  = pLow  + labourAmt;
        high = pHigh + labourAmt;
      }

      prices[svcId] = {
        low, high, midpoint: Math.round((low + high) / 2),
        partsLow: pLow, partsHigh: pHigh,
        labourLow: lLow, labourHigh: lHigh,
        labourHours: lHours,
      };
    }

    // Brake pad jobs: enforce 2.25hrs to include rotor machining time
    const BRAKE_PAD_LABOUR_HRS = 2.25;
    const brakePadLabour = Math.round(BRAKE_PAD_LABOUR_HRS * NZD_LABOUR_RATE);
    for (const svcId of ['brakes_front_pads', 'brakes_rear_pads']) {
      if (prices[svcId]) {
        prices[svcId].labourLow  = brakePadLabour;
        prices[svcId].labourHigh = brakePadLabour;
        prices[svcId].labourHours = '2.25';
        prices[svcId].low  = prices[svcId].partsLow  + brakePadLabour;
        prices[svcId].high = prices[svcId].partsHigh + brakePadLabour;
        prices[svcId].midpoint = Math.round((prices[svcId].low + prices[svcId].high) / 2);
      }
    }

    // Fixed-price services: not in parts_data (no vehicle-specific parts), priced by labour rate
    if (!prices['wof']) {
      // WOF: ~0.5hr visual inspection; total is a regulated ~$55–75 flat fee in NZ
      prices['wof'] = { low: 55, high: 75, midpoint: 65, partsLow: 0, partsHigh: 0,
        labourLow: 65, labourHigh: 65, labourHours: '0.5' };
    }
    if (!prices['diag_inspection']) {
      // Fixed $99 diagnostic fee
      prices['diag_inspection'] = { low: 99, high: 99, midpoint: 99, partsLow: 0, partsHigh: 0,
        labourLow: 99, labourHigh: 99, labourHours: '1' };
    }
    if (!prices['ppi']) {
      // Pre-Purchase Inspection: fixed $199 (2hrs labour, no vehicle-specific parts)
      prices['ppi'] = { low: 199, high: 199, midpoint: 199, partsLow: 0, partsHigh: 0,
        labourLow: 199, labourHigh: 199, labourHours: '2' };
    }
    // Merge transmission fluid detail into the transmission price
    if (prices['transmission'] && (prices as any)['_trans_detail']) {
      Object.assign(prices['transmission'], (prices as any)['_trans_detail']);
      delete (prices as any)['_trans_detail'];
    }
    // Merge oil detail into oil service price
    if ((prices as any)['_oil_detail']) {
      if (prices['oil']) Object.assign(prices['oil'], (prices as any)['_oil_detail']);
      delete (prices as any)['_oil_detail'];
    }
    if (!prices['brake_fluid']) {
      // ~0.75hr flush + DOT4 fluid ($25–35) + sundries
      const bfLabour = Math.round(0.75 * NZD_LABOUR_RATE);
      prices['brake_fluid'] = { low: 25 + bfLabour, high: 45 + bfLabour, midpoint: 35 + bfLabour,
        partsLow: 25, partsHigh: 45, labourLow: bfLabour, labourHigh: bfLabour, labourHours: '0.75',
        fluidType: 'DOT 4', fluidCapacityL: 0.5, fluidCostHigh: 45, sundries: 5 };
    } else {
      // If it came from parts_data, still annotate with fluid type
      Object.assign(prices['brake_fluid'], { fluidType: 'DOT 4', fluidCapacityL: 0.5, sundries: 5 });
    }
    if (!prices['coolant_flush']) {
      // ~1hr drain/flush/refill + OAT coolant (~5L @ $9–$17/L NZ retail)
      const cfLabour = Math.round(1.0 * NZD_LABOUR_RATE);
      const cfFluidLow = Math.round(coolantCapacityL * 9);
      const cfFluidHigh = Math.round(coolantCapacityL * 17);
      prices['coolant_flush'] = { low: cfFluidLow + cfLabour, high: cfFluidHigh + cfLabour,
        midpoint: Math.round((cfFluidLow + cfFluidHigh) / 2) + cfLabour,
        partsLow: cfFluidLow, partsHigh: cfFluidHigh, labourLow: cfLabour, labourHigh: cfLabour,
        labourHours: '1', fluidType: 'OAT Coolant', fluidCapacityL: coolantCapacityL,
        fluidCostHigh: cfFluidHigh, sundries: 10 };
    } else {
      Object.assign(prices['coolant_flush'], { fluidType: 'OAT Coolant', fluidCapacityL: coolantCapacityL, sundries: 10 });
    }

    // Timing chain: if chain-driven but no parts_data entry, add an indicative range
    if (!prices['timing'] && timingDrive === 'chain') {
      const tcLabour = Math.round(5.0 * NZD_LABOUR_RATE);
      prices['timing'] = { low: 600 + tcLabour, high: 1100 + tcLabour,
        midpoint: 850 + tcLabour, partsLow: 600, partsHigh: 1100,
        labourLow: tcLabour, labourHigh: tcLabour, labourHours: '5',
        indicative: true };
    }

    const waterPumpHasPartsData = !!prices['water_pump'];

    // Water pump always includes thermostat housing + coolant drain/refill.
    // Also add coolantLow/coolantHigh breakdown fields for the UI to display.
    const WP_COOLANT_LOW = 45, WP_COOLANT_HIGH = 85;
    const WP_THERMO_LOW = 120, WP_THERMO_HIGH = 180; // thermostat housing parts
    const wpCoolantLabour = Math.round(0.5 * NZD_LABOUR_RATE);
    if (prices['water_pump']) {
      // Merge in thermostat housing parts if they have their own price; otherwise use defaults
      const thParts = prices['thermostat_housing'];
      const thermoLow  = thParts ? thParts.partsLow  : WP_THERMO_LOW;
      const thermoHigh = thParts ? thParts.partsHigh : WP_THERMO_HIGH;
      prices['water_pump'].low  += thermoLow  + WP_COOLANT_LOW  + wpCoolantLabour;
      prices['water_pump'].high += thermoHigh + WP_COOLANT_HIGH + wpCoolantLabour;
      prices['water_pump'].partsLow  += thermoLow  + WP_COOLANT_LOW;
      prices['water_pump'].partsHigh += thermoHigh + WP_COOLANT_HIGH;
      prices['water_pump'].labourLow  += wpCoolantLabour;
      prices['water_pump'].labourHigh += wpCoolantLabour;
      const prevHrs = parseFloat(prices['water_pump'].labourHours || '0');
      prices['water_pump'].labourHours = String(prevHrs + 0.5);
      prices['water_pump'].coolantLow  = WP_COOLANT_LOW;
      prices['water_pump'].coolantHigh = WP_COOLANT_HIGH;
      // Suppress thermostat_housing as a separate priced item (it's bundled into water_pump)
      delete prices['thermostat_housing'];
    }
    if (!prices['water_pump']) {
      // Fallback: pump + thermostat housing ($320-480) + coolant + 2hrs labour
      const wpFallbackLabour = Math.round(2.0 * NZD_LABOUR_RATE);
      prices['water_pump'] = { low: 320 + WP_THERMO_LOW + WP_COOLANT_LOW + wpFallbackLabour,
        high: 480 + WP_THERMO_HIGH + WP_COOLANT_HIGH + wpFallbackLabour,
        midpoint: 400 + 150 + 65 + wpFallbackLabour,
        partsLow: 320 + WP_THERMO_LOW + WP_COOLANT_LOW, partsHigh: 480 + WP_THERMO_HIGH + WP_COOLANT_HIGH,
        labourLow: wpFallbackLabour, labourHigh: wpFallbackLabour, labourHours: '2',
        coolantLow: WP_COOLANT_LOW, coolantHigh: WP_COOLANT_HIGH };
    }
    if (!prices['full']) {
      // Full service: oil + filter + extras + 2.5hrs labour
      const fsOilMid = Math.round(oilCapacity * 20);
      const fsParts = fsOilMid + 55; // oil + oil filter + air filter check
      const fsLabour = Math.round(2.5 * NZD_LABOUR_RATE);
      prices['full'] = { low: fsParts + fsLabour - 30, high: fsParts + fsLabour + 30,
        midpoint: fsParts + fsLabour, partsLow: fsParts - 30, partsHigh: fsParts + 30,
        labourLow: fsLabour, labourHigh: fsLabour, labourHours: '2.5' };
    }
    // Attach oil spec to full service
    if (prices['full'] && vehicleOilType) {
      prices['full'].oilType = vehicleOilType;
      prices['full'].oilCapacityL = oilCapacity;
    }
    if (prices['oil'] && vehicleOilType && !prices['oil'].oilType) {
      prices['oil'].oilType = vehicleOilType;
      prices['oil'].oilCapacityL = oilCapacity;
    }

    // Water pump recommendation: true when timing_drive is 'belt' and make is VW/Skoda/Seat/Audi
    // (belt-driven water pump engines where replacement is standard practice alongside cambelt).
    const wpMakes = ['volkswagen', 'vw', 'skoda', 'seat', 'audi'];
    const waterPumpRecommended = timingDrive === 'belt' &&
      wpMakes.some(m => (custVehicle.make || '').toLowerCase().includes(m));
    // Cambelt add-on: Water Pump + Thermostat Housing + Auxiliary Belt + Coolant
    // (standalone water_pump price already includes thermostat; this add-on is the incremental
    //  cost of doing it at the same time as cambelt — labour savings vs separate job)
    const wpPartsLow  = 280 + 35 + 120;  // pump + auxiliary belt + thermostat housing
    const wpPartsHigh = 420 + 60 + 180;
    const wpCoolantLow = 60, wpCoolantHigh = 90;
    const wpLabour    = Math.round(1.0 * NZD_LABOUR_RATE);
    res.json({
      prices, timingDrive, vehicleId,
      shopFee: shopFee,
      vehicleOilType,
      waterPumpRecommended,
      waterPumpInDB: timingDrive !== 'na',
      waterPump: waterPumpRecommended
        ? { partsLow: wpPartsLow, partsHigh: wpPartsHigh, coolantLow: wpCoolantLow, coolantHigh: wpCoolantHigh, labourExtra: wpLabour,
            low: wpPartsLow + wpCoolantLow + wpLabour, high: wpPartsHigh + wpCoolantHigh + wpLabour }
        : null,
    });
  } catch (err) {
    console.error('[fleet-prices]', err);
    res.json({ prices: {}, timingDrive: null, vehicleId: null });
  }
});

// GET /api/services/search?q=text — fuzzy search service catalog for "something else" booking flow
app.get('/api/services/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ results: [] });

  // Extended service catalog with aliases for fuzzy matching
  const EXTENDED: Array<{ id: string; name: string; aliases: string[]; indicativePrice: number }> = [
    { id: 'oil', name: 'Oil & Filter Change', aliases: ['oil change', 'oil service', 'engine oil', 'lube'], indicativePrice: 180 },
    { id: 'timing', name: 'Cambelt Replacement', aliases: ['cambelt', 'timing belt', 'cam belt', 'timing kit', 'tensioner', 'idler'], indicativePrice: 1200 },
    { id: 'transmission', name: 'Transmission Service', aliases: ['gearbox', 'gearbox oil', 'dsg', 'dct', 'cvt', 'auto trans', 'transmission fluid', 'diff oil'], indicativePrice: 620 },
    { id: 'brakes_front_pads', name: 'Front Brake Pads', aliases: ['front brakes', 'brake pads front', 'disc pads'], indicativePrice: 220 },
    { id: 'brakes_front_rotors', name: 'Front Rotors & Pads', aliases: ['front rotors', 'front discs', 'disc rotors front'], indicativePrice: 580 },
    { id: 'brakes_rear_pads', name: 'Rear Brake Pads', aliases: ['rear brakes', 'back brakes', 'rear pads'], indicativePrice: 190 },
    { id: 'brakes_rear_rotors', name: 'Rear Rotors & Pads', aliases: ['rear rotors', 'rear discs', 'back rotors'], indicativePrice: 480 },
    { id: 'alignment', name: 'Wheel Alignment', aliases: ['alignment', 'tracking', 'toe in', 'camber', 'steering pull'], indicativePrice: 130 },
    { id: 'spark_plugs', name: 'Spark Plugs', aliases: ['plugs', 'iridium', 'ignition', 'misfires', 'rough idle'], indicativePrice: 240 },
    { id: 'diag_inspection', name: 'Diagnostic Inspection', aliases: ['check', 'inspect', 'fault', 'warning light', 'engine light', 'scan', 'code', 'ecu', 'obd'], indicativePrice: 99 },
    { id: 'brake_fluid', name: 'Brake Fluid Flush', aliases: ['brake fluid', 'dot 4', 'dot4', 'bleeding brakes'], indicativePrice: 145 },
    { id: 'cabin_filter', name: 'Cabin Air Filter', aliases: ['cabin filter', 'pollen filter', 'air con filter', 'hvac filter'], indicativePrice: 110 },
    { id: 'coolant_flush', name: 'Coolant Flush', aliases: ['coolant', 'antifreeze', 'radiator flush', 'coolant service', 'overheating'], indicativePrice: 220 },
    { id: 'ignition_coils', name: 'Ignition Coils', aliases: ['ignition coils', 'coil pack', 'coil packs', 'misfiring', 'misfire'], indicativePrice: 350 },
    { id: 'water_pump', name: 'Water Pump Replacement', aliases: ['water pump', 'pump replacement', 'coolant pump', 'cooling'], indicativePrice: 435 },
    { id: 'thermostat_housing', name: 'Thermostat Housing Replacement', aliases: ['thermostat', 'thermostat housing', 'cooling system'], indicativePrice: 380 },
    { id: 'ac_regas', name: 'Air Conditioning Re-gas', aliases: ['air con', 'ac regas', 'aircon', 'air conditioning', 'a/c', 'ac gas', 'cold air', 'ac not cold'], indicativePrice: 180 },
    { id: 'battery', name: 'Battery Replacement', aliases: ['battery', '12v', 'flat battery', 'wont start', "won't start", 'dead battery'], indicativePrice: 280 },
    { id: 'wiper_blades', name: 'Wiper Blades', aliases: ['wipers', 'wiper blade', 'windscreen wipers', 'smearing'], indicativePrice: 60 },
    { id: 'power_steering_fluid', name: 'Power Steering Fluid', aliases: ['power steering', 'steering fluid', 'stiff steering'], indicativePrice: 120 },
  ];

  const CATALOG_IDS = new Set(['oil', 'timing', 'transmission', 'brakes_front_pads', 'brakes_front_rotors', 'brakes_rear_pads', 'brakes_rear_rotors', 'alignment', 'spark_plugs', 'diag_inspection']);

  const results = EXTENDED.filter(s => {
    if (CATALOG_IDS.has(s.id)) return false; // already shown in main catalog
    const haystack = [s.name, ...s.aliases].join(' ').toLowerCase();
    return q.split(/\s+/).every(word => haystack.includes(word));
  }).slice(0, 4).map(s => ({ id: s.id, name: s.name, indicativePrice: s.indicativePrice }));

  res.json({ results });
});

// Indicative all-in Torqued prices (NZD) — mirrors the booking catalog, used for AI price guidance.
const SERVICE_PRICES: Record<string, { name: string; price: number }> = {
  oil: { name: 'Standard Service', price: 180 }, wof: { name: 'Warrant of Fitness', price: 65 },
  full: { name: 'Full Service', price: 350 }, brakes_front_pads: { name: 'Front Brake Pads', price: 220 },
  brakes_front_rotors: { name: 'Front Rotors & Pads', price: 580 }, brakes_rear_pads: { name: 'Rear Brake Pads', price: 190 },
  brakes_rear_rotors: { name: 'Rear Rotors & Pads', price: 480 }, timing: { name: 'Cambelt', price: 2289 },
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
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI assistant not configured (add Anthropic API key).' });

    const supabase = getSupabaseAdmin();
    if (supabase && ownerId) {
      const { data: prof } = await supabase.from('profiles').select('ai_disabled').eq('id', ownerId).maybeSingle();
      if (prof?.ai_disabled) return res.status(403).json({ error: 'AI features have been disabled for this account. Contact support if you believe this is an error.' });
    }
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
    const reply = await callClaudeChat([sys, ...normalised], 450);
    res.json({ reply: reply.trim(), mechanicsNearby: mechCount, focusRego: focusRego || null });
  } catch (err: any) {
    console.error('[ai/customer-assistant]', err);
    res.status(500).json({ error: err?.message || 'Assistant failed' });
  }
});

// POST /api/ai/health-insights — live vehicle health insights from real mileage + history.
// Also accepts ?mechanic_id=<uuid> to restrict to vehicles that have come through that mechanic.
app.post('/api/ai/health-insights', async (req, res) => {
  try {
    const { rego, make, model, year, mileage, history: clientHistory, mechanic_id, ownerId } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured (add Anthropic API key).' });

    const supabase = getSupabaseAdmin();
    if (supabase && ownerId && !mechanic_id) {
      const { data: prof } = await supabase.from('profiles').select('ai_disabled').eq('id', ownerId).maybeSingle();
      if (prof?.ai_disabled) return res.status(403).json({ error: 'AI features have been disabled for this account.' });
    }
    const formattedRego = rego ? String(rego).toUpperCase().trim() : null;

    // When called from the mechanic portal: verify the vehicle has come through this mechanic
    // (cold quote recipient, future booking, or completed job).
    if (mechanic_id && formattedRego && supabase) {
      const { data: rel } = await supabase
        .from('bookings')
        .select('id')
        .eq('mechanic_id', mechanic_id)
        .eq('vehicle_rego', formattedRego)
        .limit(1).maybeSingle();
      if (!rel) return res.status(403).json({ error: 'This vehicle has not come through your system.' });
    }

    // Fetch authoritative history from the DB for the given rego (ignores stale client-provided history).
    let history = clientHistory ?? [];
    if (supabase && formattedRego) {
      const [histRes, jobsRes] = await Promise.all([
        supabase.from('vehicle_history')
          .select('service_date, work_done, mileage, provider')
          .eq('rego', formattedRego)
          .order('service_date', { ascending: false }).limit(20),
        supabase.from('bookings')
          .select('service_ids, quote_items, description, completed_at, mileage_out')
          .eq('vehicle_rego', formattedRego)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false }).limit(10),
      ]);
      const dbHistory: any[] = histRes.data ?? [];
      const jobHistory = (jobsRes.data ?? []).map((j: any) => {
        // Describe the work: standard services, else the quote's parts/notes, else the description.
        const fromServices = ((j.service_ids || []) as string[]).map((id: string) => SERVICE_NAMES[id] || id).join(', ');
        const qi = j.quote_items;
        const fromQuote = qi && Array.isArray(qi.parts)
          ? [qi.parts.filter((p: any) => p?.name).map((p: any) => p.name).join(', '), qi.notes].filter(Boolean).join(' — ')
          : '';
        return {
          service_date: j.completed_at?.slice(0, 10) || null,
          work_done: fromServices || fromQuote || j.description || 'Torqued service',
          mileage: j.mileage_out ?? null,
          provider: 'Torqued',
        };
      });
      const combined = [...dbHistory, ...jobHistory]
        .sort((a, b) => (b.service_date || '').localeCompare(a.service_date || ''))
        .slice(0, 20);
      if (combined.length > 0) history = combined;
    }

    // Also look up the vehicle record for make/model/year/mileage if not supplied
    let resolvedMake = make, resolvedModel = model, resolvedYear = year, resolvedMileage = mileage;
    if (supabase && formattedRego && (!make || !model)) {
      const { data: veh } = await supabase.from('vehicles')
        .select('make, model, year, mileage').eq('rego', formattedRego).single();
      if (veh) {
        resolvedMake = resolvedMake || veh.make;
        resolvedModel = resolvedModel || veh.model;
        resolvedYear = resolvedYear || veh.year;
        resolvedMileage = resolvedMileage || veh.mileage;
      }
    }

    const hasHistory = history.length > 0;

    // Return cached insights if mileage + history count unchanged
    const cacheKey = `${formattedRego}|${resolvedMileage ?? 0}|${history.length}`;
    const cached = _aiInsightCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < AI_INSIGHT_TTL) {
      return res.json({ insights: cached.insights, hasHistory: cached.hasHistory, cached: true });
    }

    const historyText = hasHistory
      ? `Service history (most recent first):\n${history.slice(0, 20).map((h: any) => `- ${h.service_date || 'unknown date'}: ${h.work_done}${h.mileage ? ` at ${h.mileage} km` : ''}${h.provider ? ` (${h.provider})` : ''}`).join('\n')}`
      : 'No service history on file.';

    const km = Number(resolvedMileage) || 0;
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `You are an NZ vehicle service advisor. Today is ${today}.

Vehicle: ${resolvedYear || 'unknown year'} ${resolvedMake || ''} ${resolvedModel || ''} (${formattedRego || ''}), current odometer: ${km ? `${km.toLocaleString()} km` : 'unknown'}.

${historyText}

Your job: produce ONLY genuine, vehicle-specific service recommendations. Rules:
1. Read the service history carefully. If a service (e.g. cambelt, oil change, transmission) was completed recently, mark it "good" — do NOT suggest it is due unless the interval has genuinely been exceeded.
2. Only include a service if it is relevant to this specific vehicle. Examples:
   - EVs and PHEVs do not need cambelt or transmission fluid services in the same way — adapt accordingly.
   - Chain-driven engines (most modern VAG/Toyota/Honda engines) need no cambelt — use severity "info" if you mention it at all, or skip.
   - PHEVs may have extended oil intervals — reflect the manufacturer recommendation.
3. Use ONLY the actual service history and vehicle age/mileage to determine urgency. Do not invent or assume services that the history shows were recently done.
4. Typical NZ intervals for reference (adjust for this specific vehicle/manufacturer):
   - Oil & Filter: 10,000–15,000 km or 12 months (PHEVs often longer)
   - Cambelt: 100,000 km or 5 years (belt-driven only)
   - Transmission fluid: 60,000 km or 4 years
   - Brakes: inspect every 20,000 km or 12 months
   - Spark plugs: 40,000–100,000 km depending on type
   - Coolant: 60,000 km or 3–5 years
5. Return 3–6 insights. Only include services that are actually due, overdue, or approaching due based on real evidence. If the history clearly shows a service was done recently, mark it "good" and give next-due info, or skip it entirely if there is nothing useful to add.
6. Km calculations: km_since_last = current_km − km_at_last_service. Only mark "overdue" if km_since_last ≥ interval OR date interval is clearly exceeded.

Severity:
  "good"    = confirmed recently done, clearly within interval
  "due"     = approaching interval (within ~10%), or due based on time even if km not reached
  "overdue" = interval genuinely exceeded by km or time
  "info"    = not applicable to this vehicle (e.g. no cambelt, EV drivetrain), or general advisory

Return ONLY valid JSON (no markdown): {"insights":[{"title":"short label","detail":"1–2 sentences with specific km/date context.","severity":"good|due|overdue|info"}]}`;

    const raw = await callClaudeChat([{ role: 'user', content: prompt }], 800, true, false);
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return res.status(422).json({ error: 'Could not parse insights', raw: text.slice(0, 200) }); }
    const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
    _aiInsightCache.set(cacheKey, { insights, hasHistory, ts: Date.now() });
    res.json({ insights, hasHistory });
  } catch (err: any) {
    console.error('[ai/health-insights]', err);
    res.status(500).json({ error: err?.message || 'Insights failed' });
  }
});

// POST /api/ai/oil-price — looks up current NZ retail price per litre for a given oil grade via Claude
app.post('/api/ai/oil-price', async (req, res) => {
  try {
    const { grade } = req.body;
    if (!grade?.trim()) return res.status(400).json({ error: 'Oil grade is required (e.g. 5W-30).' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured (add Anthropic API key).' });
    const prompt = `You are a NZ automotive parts pricing expert with current market knowledge.
What is the approximate current retail price per litre (NZD, incl GST) for ${grade.trim()} engine oil sold in New Zealand?
Consider brands like Castrol, Penrite, Mobil 1, Gulf Western typically stocked at Repco or Supercheap.
Return ONLY JSON: {"pricePerLitre": <number>, "note": "<1 sentence reasoning>"}
Use a realistic mid-market figure. Do not include $ symbol.`;
    const text = await callClaudeChat([{ role: 'user', content: prompt }], 200, true);
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
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured (add Anthropic API key).' });

    const isTransmission = type === 'transmission';
    const prompt = isTransmission
      ? `You are a NZ automotive expert. For the vehicle or transmission service: "${query.trim()}"
Provide the standard transmission fluid (ATF) refill capacity in litres and the approximate NZ retail cost per litre (NZD incl GST) for the correct fluid.
Return ONLY JSON: {"transFluidCapacityL": <number>, "transFluidCostPerL": <number>, "fluidType": "<fluid spec e.g. Dexron VI>", "note": "<1 sentence>"}`
      : `You are a NZ automotive expert. For the vehicle: "${query.trim()}"
Provide: engine oil refill capacity (L), recommended oil grade (e.g. 5W-30), approximate NZ retail oil price per litre (NZD incl GST, mid-market brands like Penrite/Castrol at Repco), and approximate NZ retail price for a compatible oil filter (NZD incl GST).
Return ONLY JSON: {"oilCapacityL": <number>, "oilGrade": "<grade>", "oilCostPerL": <number>, "filterCostNZD": <number>, "note": "<1 sentence>"}`;

    const text = await callClaudeChat([{ role: 'user', content: prompt }], 300, true);
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

// POST /api/mechanic/ppi — save / complete a Pre-Purchase Inspection.
app.post('/api/mechanic/ppi', async (req, res) => {
  try {
    const { id, mechanicId, workshopName: workshopNameIn, bookingId, rego, make, model, submodel, engine, customerName, customerEmail, mileage, checklist, inspectorComments, recommendations, complete, pdfBase64 } = req.body;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const payload: Record<string, any> = {
      mechanic_id: mechanicId,
      booking_id: bookingId || null,
      rego: rego ? String(rego).toUpperCase().trim() : null,
      make: make || null, model: model || null, submodel: submodel || null, engine: engine || null,
      customer_name: customerName || null, customer_email: customerEmail || null,
      mileage: mileage != null && mileage !== '' ? Number(mileage) : null,
      checklist: checklist || [],
      inspector_comments: inspectorComments || null,
      recommendations: recommendations || null,
      status: complete ? 'completed' : 'in_progress',
      completed_at: complete ? new Date().toISOString() : null,
    };
    if (id) payload.id = id;
    const { data, error } = await supabase.from('ppi_inspections').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Email customer the completed report
    if (complete && customerEmail) {
      try {
        const { data: mechProfile } = await supabase.from('profiles').select('name').eq('id', mechanicId).single();
        const workshopName = mechProfile?.name || workshopNameIn || 'your workshop';
        const vehicleDesc = [make, model, submodel].filter(Boolean).join(' ') || String(rego).toUpperCase();
        const transporter = getMailTransporter();
        if (transporter) {
          const attachments: any[] = [];
          if (pdfBase64) {
            attachments.push({
              filename: `Torqued-PPI-${String(rego).toUpperCase()}.pdf`,
              content: Buffer.from(pdfBase64, 'base64'),
              contentType: 'application/pdf',
            });
          }
          await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
            to: customerEmail,
            subject: `Your Pre-Purchase Inspection Report — ${String(rego).toUpperCase()}`,
            attachments,
            html: emailWrap(`<tr><td style="padding:36px 32px;">
<span style="display:inline-block;background:rgba(255,24,0,.08);color:${EMAIL_RED};font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 12px;border-radius:6px;font-family:${EMAIL_BODY_FONT};">Pre-Purchase Inspection</span>
<div style="margin:18px 0 0;">${emailTitle('Your inspection report')}</div>
${emailGreeting(customerName)}
${emailPara(`Your pre-purchase inspection for <strong style="color:${EMAIL_DARK};">${vehicleDesc}</strong> (${String(rego).toUpperCase()}) has been completed by <strong style="color:${EMAIL_DARK};">${workshopName}</strong>. Your full itemised report is attached as a PDF.`)}
${emailPara(pdfBase64 ? 'See the attached PDF for the full itemised inspection report.' : 'Your full itemised PDF report will be provided by the workshop directly.')}
</td></tr>`),
          }).catch(e => console.warn('[ppi] email failed:', e?.message));
        }
      } catch (emailErr) { console.warn('[ppi] email error:', emailErr); }
    }

    res.json({ success: true, ppi: data });
  } catch (err) {
    console.error('[mechanic/ppi]', err);
    res.status(500).json({ error: 'Could not save inspection' });
  }
});

// GET /api/mechanic/next-available — soonest bookable drop-off dates for a workshop.
// Factors in: parts lead time (if the job needs parts ordered in), the workshop's
// recurring weekly availability, closed periods (holidays), and a business-day floor.
app.get('/api/mechanic/next-available', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    const needsParts = req.query.needsParts === '1' || req.query.needsParts === 'true';
    const count = Math.min(6, Math.max(1, Number(req.query.count) || 3));
    const leadDaysOverride = req.query.leadDays != null ? Math.max(0, Number(req.query.leadDays)) : null;
    const supabase = getSupabaseAdmin();
    if (!supabase || !mechanicId) return res.json({ dates: [], earliest: null });

    const [profileRes, slotsRes, periodsRes] = await Promise.all([
      supabase.from('profiles').select('parts_lead_days').eq('id', mechanicId).maybeSingle(),
      supabase.from('mechanic_availability').select('day_of_week').eq('mechanic_id', mechanicId),
      supabase.from('mechanic_closed_periods').select('start_date, end_date').eq('mechanic_id', mechanicId),
    ]);

    const partsLead = leadDaysOverride !== null ? leadDaysOverride : Math.max(0, Number(profileRes.data?.parts_lead_days ?? 1));
    // day_of_week in our schema: 0=Mon … 6=Sun. Convert a JS Date to that index.
    const toMonZero = (d: Date) => (d.getDay() + 6) % 7;
    const openDows = new Set<number>((slotsRes.data ?? []).map((s: any) => Number(s.day_of_week)));
    const hasAvailabilityConfigured = openDows.size > 0;
    const closed = (periodsRes.data ?? []).map((p: any) => ({ start: p.start_date, end: p.end_date }));
    const isClosed = (iso: string) => closed.some(c => iso >= c.start && iso <= c.end);

    // Earliest possible drop-off: tomorrow, plus parts lead (business days) if needed.
    const addBiz = (from: Date, days: number) => {
      const d = new Date(from); let added = 0;
      while (added < days) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) added++; }
      return d;
    };
    const start = needsParts ? addBiz(new Date(), partsLead + 1) : addBiz(new Date(), 1);

    const isBookable = (d: Date) => {
      const dow = toMonZero(d);
      const iso = d.toISOString().slice(0, 10);
      if (isClosed(iso)) return false;
      // If the workshop set specific hours, respect them; otherwise default to Mon–Fri.
      if (hasAvailabilityConfigured) return openDows.has(dow);
      return d.getDay() !== 0 && d.getDay() !== 6;
    };

    const out: { date: string; day: string; label: string }[] = [];
    const cursor = new Date(start);
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    for (let i = 0; i < 90 && out.length < count; i++) {
      if (isBookable(cursor)) {
        const iso = cursor.toISOString().slice(0, 10);
        const dnum = cursor.getDate();
        const suffix = dnum % 10 === 1 && dnum !== 11 ? 'st' : dnum % 10 === 2 && dnum !== 12 ? 'nd' : dnum % 10 === 3 && dnum !== 13 ? 'rd' : 'th';
        out.push({ date: iso, day: dayNames[cursor.getDay()], label: `${dayNames[cursor.getDay()]} ${dnum}${suffix}` });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    res.json({ dates: out, earliest: out[0]?.date ?? null, partsLead, needsParts });
  } catch (err: any) {
    console.error('[mechanic/next-available]', err);
    res.status(500).json({ error: err?.message || 'Failed', dates: [], earliest: null });
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

// ── Staff Roster ─────────────────────────────────────────────────────────────
// GET /api/mechanic/roster?mechanicId=&from=&to= — team members + shifts in a date range
app.get('/api/mechanic/roster', async (req, res) => {
  try {
    const { mechanicId, from, to } = req.query as Record<string, string>;
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ staff: [], shifts: [] });

    let shiftQ = supabase.from('mechanic_roster')
      .select('id, staff_id, shift_date, start_time, end_time, break_start, break_end')
      .eq('mechanic_id', mechanicId);
    if (from) shiftQ = shiftQ.gte('shift_date', from);
    if (to) shiftQ = shiftQ.lte('shift_date', to);

    const [staffRes, shiftRes] = await Promise.all([
      supabase.from('mechanic_staff').select('id, name, role').eq('mechanic_id', mechanicId).order('created_at'),
      shiftQ.order('shift_date').order('start_time'),
    ]);
    res.json({ staff: staffRes.data ?? [], shifts: shiftRes.data ?? [] });
  } catch (err: any) {
    console.error('[roster]', err);
    res.json({ staff: [], shifts: [] });
  }
});

// POST /api/mechanic/staff — add a team member
app.post('/api/mechanic/staff', async (req, res) => {
  try {
    const { mechanicId, name, role } = req.body;
    if (!mechanicId || !name?.trim()) return res.status(400).json({ error: 'mechanicId and name required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    const { data, error } = await supabase.from('mechanic_staff')
      .insert({ mechanic_id: mechanicId, name: name.trim(), role: role?.trim() || null })
      .select('id, name, role').single();
    if (error) throw error;
    res.json({ staff: data });
  } catch (err: any) {
    console.error('[staff/add]', err);
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// DELETE /api/mechanic/staff/:id — remove a team member (cascades their shifts)
app.delete('/api/mechanic/staff/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    await supabase.from('mechanic_staff').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// POST /api/mechanic/roster/shift — roster a staff member on a date
app.post('/api/mechanic/roster/shift', async (req, res) => {
  try {
    const { mechanicId, staffId, shiftDate, startTime, endTime, breakStart, breakEnd } = req.body;
    if (!mechanicId || !staffId || !shiftDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'mechanicId, staffId, shiftDate, startTime, endTime required' });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    const { data, error } = await supabase.from('mechanic_roster').insert({
      mechanic_id: mechanicId, staff_id: staffId, shift_date: shiftDate,
      start_time: startTime, end_time: endTime,
      break_start: breakStart || null, break_end: breakEnd || null,
    }).select('id, staff_id, shift_date, start_time, end_time, break_start, break_end').single();
    if (error) throw error;
    res.json({ shift: data });
  } catch (err: any) {
    console.error('[roster/shift]', err);
    res.status(500).json({ error: err?.message || 'Failed' });
  }
});

// DELETE /api/mechanic/roster/shift/:id — remove a rostered shift
app.delete('/api/mechanic/roster/shift/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB unavailable' });
    await supabase.from('mechanic_roster').delete().eq('id', req.params.id);
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
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured (add Anthropic API key).' });
    const prompt = `You are an NZ auto parts assistant. The mechanic needs: "${query}" for a ${year || ''} ${make || ''} ${model || ''}.
Return ONLY JSON: {"name":"clear part name","oemNumber":"OEM/part number or empty if unsure","estPriceNZD":number_or_null,"suppliers":["NZ suppliers likely to stock it, e.g. Repco, Supercheap Auto, BNT, Partmaster, Appco"],"notes":"short fitment note"}.
Only include an OEM number if you are reasonably confident; otherwise empty string. Price is a rough NZ retail estimate.`;
    const text = await callClaudeChat([{ role: 'user', content: prompt }], 350, true);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return res.status(422).json({ error: 'Could not parse result' }); }
    res.json(parsed);
  } catch (err: any) {
    console.error('[ai/parts-lookup]', err);
    res.status(500).json({ error: err?.message || 'Lookup failed' });
  }
});

// POST /api/ai/fault-code — translates a diagnostic fault code via Claude
app.post('/api/ai/fault-code', async (req, res) => {
  try {
    const { code, make, model, year, mileage, ownerId } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ translation: `Interpreting ${code.toUpperCase()}... AI not configured.` });
    }
    const supabase = getSupabaseAdmin();
    if (supabase && ownerId) {
      const { data: prof } = await supabase.from('profiles').select('ai_disabled').eq('id', ownerId).maybeSingle();
      if (prof?.ai_disabled) return res.json({ translation: 'AI features are not available for this account.' });
    }

    const prompt = `You are a concise automotive diagnostic assistant for New Zealand mechanics.
Translate fault code ${String(code).toUpperCase()} for a ${year || ''} ${make || ''} ${model || ''} at ${mileage || 'unknown'} km.
In 1-2 sentences max: what it means, the most likely cause for this vehicle, and what action to take.
Be direct and practical. No disclaimers.`;

    const text = await callClaude(prompt);
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
      source_type: 'ai_autoscan',
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
    const { data: p } = await supabase.from('profiles').select('id, name, email, phone, home_location').eq('id', owner).single();
    res.json({ ownerId: owner, name: p?.name ?? null, email: p?.email ?? null, phone: p?.phone ?? null, homeLocation: p?.home_location ?? null });
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
    // Guard: torqued_job records cannot be deleted
    const { data: record } = await supabase.from('vehicle_history').select('source_type').eq('id', id).single();
    if (record?.source_type === 'torqued_job') return res.status(403).json({ error: 'Torqued job records cannot be deleted.' });
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

// POST /api/ai/summarize — short summary of a vehicle service description
// Pass historyId to save the summary back to vehicle_history.ai_summary (avoids repeat API calls).
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { text, style, historyId } = req.body;
    if (!text || String(text).trim().length === 0) return res.status(400).json({ error: 'text is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI summary is not configured yet.' });
    const system = style === 'title'
      ? 'You turn a vehicle service description into a headline of the key work done, max 5 words, Title Case, items joined with " & ". Example: "Cambelt & Water Pump Replaced". No prices, no dates, no preamble, no trailing punctuation.'
      : 'You summarise a vehicle workshop message for the car owner in 1–2 short, plain sentences. Keep any prices, dates and required actions. No preamble.';
    const summary = await callClaudeChat([
      { role: 'system', content: system },
      { role: 'user', content: String(text).slice(0, 4000) },
    ], style === 'title' ? 30 : 160);
    const trimmed = summary.trim();
    // Save to DB if a history record id was supplied — avoids repeat API calls on reload
    if (historyId && style === 'title') {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        supabase.from('vehicle_history').update({ ai_summary: trimmed }).eq('id', historyId).then(() => {});
      }
    }
    res.json({ summary: trimmed });
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
          const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Booking Cancelled')}
${emailGreeting(ctx.custName ? ctx.custName.split(' ')[0] : 'there')}
${emailPara(`Your booking for <strong>${ctx.vehicleLabel}</strong>${ctx.mechanicName ? ` with ${ctx.mechanicName}` : ''} (Ref <strong style="color:${EMAIL_RED};">#${bookingId}</strong>) has been cancelled.`)}
${refundLine}
${emailPara(`Changed your mind? You can re-book anytime at <a href="https://torqued-psi.vercel.app" style="color:${EMAIL_RED};">torqued-psi.vercel.app</a>.`)}
</td></tr>`);
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

// POST /api/mechanic/reschedule-request — mechanic proposes a new date/time for a booking,
// optionally leaving a comment. Saves the request to the booking and emails the customer.
app.post('/api/mechanic/reschedule-request', async (req, res) => {
  try {
    const { bookingId, proposedDate, comment, mechanicName } = req.body;
    if (!bookingId || !proposedDate) return res.status(400).json({ error: 'bookingId and proposedDate are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const proposed = new Date(proposedDate);
    if (isNaN(proposed.getTime()) || proposed.getTime() < Date.now() - 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Please choose a future date/time.' });
    }

    // Save reschedule request fields on the booking row
    await supabase.from('bookings').update({
      reschedule_requested_date: proposedDate,
      reschedule_comment: comment || null,
      reschedule_status: 'pending',
    }).eq('id', bookingId);

    const ctx = await getBookingContext(bookingId);
    const dateStr = proposed.toLocaleString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const mech = mechanicName || ctx.mechanicName || 'Your workshop';

    if (ctx.email) {
      const acceptLink = `https://torqued-psi.vercel.app/customer?reschedule_accept=${encodeURIComponent(bookingId)}&proposed=${encodeURIComponent(proposedDate)}`;
      const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Reschedule Request')}
${emailGreeting(ctx.custName)}
${emailPara(`<strong>${mech}</strong> has requested to reschedule your booking (Ref: <strong style="color:${EMAIL_RED};">#${bookingId}</strong>) to:`)}
<div style="background:#f7f4f0;border-radius:12px;padding:16px 18px;margin:16px 0;text-align:center;">
  <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:18px;font-weight:900;color:${EMAIL_RED};">${dateStr}</p>
</div>
${comment ? emailPara(`<strong>Reason:</strong> ${comment}`) : ''}
${emailPara('If you are happy with this new time, click below to confirm. Otherwise, please contact us directly.')}
<a href="${acceptLink}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_TITLE_FONT};font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:12px;">Accept New Time</a>
</td></tr>`);
      try {
        const t = getMailTransporter();
        if (t) await t.sendMail({
          from: process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>',
          to: ctx.email,
          subject: `Reschedule Request for Booking #${bookingId} — ${mech}`,
          html,
        });
      } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic/reschedule-request]', err);
    res.status(500).json({ error: 'Could not send reschedule request' });
  }
});

// POST /api/mechanic/accept-reschedule — customer accepts a mechanic's proposed new date
app.post('/api/mechanic/accept-reschedule', async (req, res) => {
  try {
    const { bookingId, proposedDate } = req.body;
    if (!bookingId || !proposedDate) return res.status(400).json({ error: 'bookingId and proposedDate required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { error } = await supabase.from('bookings').update({
      date: proposedDate,
      reschedule_status: 'accepted',
      reschedule_requested_date: null,
    }).eq('id', bookingId);
    if (error) return res.status(500).json({ error: error.message });

    // Notify mechanic via email
    const ctx = await getBookingContext(bookingId);
    const dateStr = new Date(proposedDate).toLocaleString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (ctx.mechanicEmail) {
      const t = getMailTransporter();
      if (t) {
        const html = emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Reschedule Accepted')}
${emailGreeting(ctx.mechanicName)}
${emailPara(`The customer has accepted your proposed reschedule for booking <strong style="color:${EMAIL_RED};">#${bookingId}</strong>.`)}
<div style="background:#f7f4f0;border-radius:12px;padding:16px 18px;margin:16px 0;text-align:center;">
  <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:18px;font-weight:900;color:${EMAIL_RED};">${dateStr}</p>
</div>
${emailPara('The booking date has been updated. No further action needed.')}
</td></tr>`);
        try {
          await t.sendMail({
            from: process.env.SMTP_FROM || '"Torqued NZ" <no-reply@torqued.nz>',
            to: ctx.mechanicEmail,
            subject: `Reschedule Confirmed — Booking #${bookingId}`,
            html,
          });
        } catch {}
      }
    }

    res.json({ success: true, newDate: proposedDate, dateStr });
  } catch (err) {
    console.error('[mechanic/accept-reschedule]', err);
    res.status(500).json({ error: 'Could not accept reschedule' });
  }
});

// POST /api/ai/parse-receipt — extracts service history from a receipt image via Claude vision
app.post('/api/ai/parse-receipt', async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) return res.status(400).json({ error: 'fileData and mimeType are required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI receipt scanning is not configured yet.' });

    const isPdf = String(mimeType).includes('pdf');

    const prompt = `You are an expert automotive receipt parser for New Zealand workshops. Extract information from this service receipt/invoice image or PDF.

EXTRACT THESE FIELDS EXACTLY:
1. service: All work performed. If long, write a clear concise summary (e.g. "WOF, oil & filter change, front brake pads, wheel alignment"). Include all services listed.
2. date: The service/invoice date. Look for date fields, invoice date, job date. Format as DD/MM/YYYY if possible or as written on the document.
3. mileage: Odometer reading in km at time of service. Look for "km", "odometer", "mileage", "odo". Return digits only, no units or commas.
4. provider: The workshop, garage, or mechanic business name. Look at the header, logo, or "From:" field.
5. price: Total amount charged. Include $ symbol. Look for "Total", "Amount Due", "Grand Total", "Invoice Total".
6. notes: Any other relevant information — warranty terms, parts used, next service date, technician notes.

IMPORTANT: Even if the image is partially blurry or skewed, extract what you can read. Do not return empty strings if the information is visible anywhere in the document.

Return ONLY a valid JSON object: {"service":"...","date":"...","mileage":"...","provider":"...","price":"...","notes":"..."}
Use empty string "" only for fields genuinely not present in the document.`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const imgBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileData } };

    const receiptResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'Return only valid JSON. No markdown code fences, no explanation.',
        messages: [{ role: 'user', content: [imgBlock, { type: 'text', text: prompt }] }],
      }),
    });
    const receiptData = await receiptResp.json();
    if (!receiptResp.ok) throw new Error(receiptData?.error?.message || 'Claude receipt request failed');
    const text = receiptData.content?.[0]?.text ?? '';

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

    // Throttle: refuse a new code if one was just issued (< 45s ago) for this plate.
    const prior = otpStore.get(formattedRego);
    if (prior && prior.expiresAt - Date.now() > (10 * 60 * 1000 - 45 * 1000)) {
      return res.status(429).json({ error: 'A code was just sent. Please wait a moment before requesting another.' });
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
      // SMTP not configured — never log the OTP code (log exposure risk).
      console.warn('[OTP] SMTP not configured — code not sent.');
    }

    res.json({ requiresOtp: true, maskedEmail: maskEmail(ownerEmail!) });
  } catch (err) {
    console.error('[OTP send]', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// GET /api/vehicles/:rego — returns vehicle + specs (called after OTP or when no owner)
// GET /api/customer/resolve-owner?rego=xxx — re-derive ownerId + vehicle list from a plate.
// Used when the iOS session has a stale/missing ownerId so it can self-heal without a full re-login.
app.get('/api/customer/resolve-owner', async (req, res) => {
  try {
    const rego = String(req.query.rego || '').toUpperCase().trim();
    if (!rego) return res.status(400).json({ error: 'rego required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', rego).single();
    const ownerId = vehicle?.owner_id ?? null;
    let vehicles: any[] = [];
    if (ownerId) {
      const { data: rows } = await supabase.from('vehicles')
        .select('rego, make, model, year, variant, mileage, thumbnail').eq('owner_id', ownerId);
      vehicles = rows ?? [];
    }
    res.json({ ownerId, vehicles });
  } catch (err) {
    console.error('[customer/resolve-owner]', err);
    res.status(500).json({ error: 'Could not resolve owner' });
  }
});

// GET /api/customer/vehicles?ownerId=xxx — return the live vehicle list for an owner
app.get('/api/customer/vehicles', async (req, res) => {
  try {
    const ownerId = String(req.query.ownerId || '').trim();
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { data } = await supabase
      .from('vehicles')
      .select('rego, make, model, year, variant, mileage, thumbnail')
      .eq('owner_id', ownerId);
    res.json({ vehicles: data ?? [] });
  } catch (err) {
    console.error('[customer/vehicles]', err);
    res.status(500).json({ error: 'Could not fetch vehicles' });
  }
});

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

  // Derive last known mileage from service history if vehicle record shows 0 or null
  let mileage = Number(data.mileage) || 0;
  if (!mileage && history && history.length > 0) {
    const histMileages = history.map((h: any) => Number(h.mileage)).filter(n => n > 0);
    if (histMileages.length > 0) mileage = Math.max(...histMileages);
  }

  res.json({ ...data, mileage, history: history ?? [] });
});

// POST /api/otp/verify — validates code against customer_otps table, returns owner data
app.post('/api/otp/verify', async (req, res) => {
  const { rego, code } = req.body;
  if (!rego || !code) return res.status(400).json({ success: false, error: 'rego and code are required' });

  const formattedRego = (rego as string).toUpperCase().trim();
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ success: false, error: 'Database not configured' });

  const codeHash = hashOtp(String(code).trim());
  const { data: row } = await supabase
    .from('customer_otps')
    .select('rego, email, expires_at, attempts')
    .eq('rego', formattedRego)
    .eq('code_hash', codeHash)
    .maybeSingle();

  if (!row) return res.json({ success: false, error: 'Incorrect code. Please try again.' });
  if (new Date(row.expires_at) < new Date()) {
    await supabase.from('customer_otps').delete().eq('rego', formattedRego);
    return res.json({ success: false, error: 'Code has expired. Please request a new one.' });
  }

  // Clear after use — one-time code
  await supabase.from('customer_otps').delete().eq('rego', formattedRego);

  // Return the verified owner's email, id, and ALL their vehicles (the garage)
  let email: string | null = row.email ?? null;
  let ownerId: string | null = null;
  let vehicles: any[] = [];

  const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', formattedRego).single();
  if (vehicle?.owner_id) {
    ownerId = vehicle.owner_id;
    if (!email) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
      email = profile?.email ?? null;
    }
    const { data: rows } = await supabase
      .from('vehicles')
      .select('rego, make, model, year, variant, mileage, thumbnail')
      .eq('owner_id', ownerId);
    vehicles = rows ?? [];
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

// POST /api/customer/remove-vehicle — detach a plate from a customer's account.
// Preserves all vehicle_history rows; just clears owner_id so a new owner can claim the plate.
app.post('/api/customer/remove-vehicle', async (req, res) => {
  try {
    const { ownerId, rego } = req.body;
    if (!ownerId || !rego) return res.status(400).json({ error: 'ownerId and rego are required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const formattedRego = (rego as string).toUpperCase().trim();
    const { data: vehicle } = await supabase.from('vehicles').select('owner_id').eq('rego', formattedRego).single();
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    // Primary check: direct owner_id match
    let authorised = vehicle.owner_id === ownerId;

    // Fallback: both IDs map to profiles with the same email (handles passkey vs email auth creating different profile IDs)
    if (!authorised && vehicle.owner_id) {
      const [{ data: rp }, { data: vp }] = await Promise.all([
        supabase.from('profiles').select('email').eq('id', ownerId).single(),
        supabase.from('profiles').select('email').eq('id', vehicle.owner_id).single(),
      ]);
      if (rp?.email && vp?.email && rp.email.toLowerCase() === vp.email.toLowerCase()) {
        authorised = true;
      }
      console.log('[remove-vehicle] fallback ownership check →', authorised ? 'authorised' : 'denied');
    }

    if (!authorised) {
      console.log('[remove-vehicle] 403', { requestOwnerId: ownerId, vehicleOwnerId: vehicle.owner_id, rego: formattedRego });
      return res.status(403).json({ error: 'Not authorised to remove this vehicle' });
    }

    await Promise.all([
      supabase.from('vehicles').update({ owner_id: null }).eq('rego', formattedRego),
      supabase.from('vehicle_history').delete().eq('rego', formattedRego),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('[customer/remove-vehicle]', err);
    res.status(500).json({ error: 'Could not remove vehicle' });
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
      const { type, bookingId, mechanicId, source, userId } = session.metadata ?? {};

      if (type === 'repair_payment' && bookingId) {
        // Don't overwrite an existing customer email with Stripe's if we already have one on the booking.
        const update: Record<string, any> = {
          payment_status: 'confirmed', status: 'booked', stripe_session_id: session.id,
        };
        const stripePhone = session.customer_details?.phone;
        if (session.customer_details?.email) update.email = session.customer_details.email;
        if (session.customer_details?.name) update.customer_name = session.customer_details.name;
        if (stripePhone) update.customer_phone = stripePhone;
        const { error } = await supabase.from('bookings').update(update).eq('id', bookingId);
        if (error) console.error('[Webhook] Failed to update booking:', error.message);
        else console.log(`[Webhook] Booking ${bookingId} confirmed via payment`);

        // Sync the phone Stripe collected back to the customer's profile so it persists system-wide
        // and can be shared with mechanics. Match by userId (if known) else by the Stripe email.
        if (stripePhone) {
          try {
            if (userId) {
              await supabase.from('profiles').update({ phone: stripePhone }).eq('id', userId);
            } else if (session.customer_details?.email) {
              await supabase.from('profiles').update({ phone: stripePhone }).ilike('email', session.customer_details.email);
            }
          } catch (e) { console.error('[Webhook] phone profile sync failed:', e); }
        }

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
async function makeSubscriptionCheckout(email: string, mechanicId: string, origin: string, trialDaysOrBillingType?: number | string) {
  const stripe = getStripe();
  if (!stripe) {
    return { id: 'mock_sub_session_id', url: `${origin}/mechanic?session_id=mock_sub_session_id&mechanic_id=${mechanicId}`, isMock: true };
  }
  const billingType = typeof trialDaysOrBillingType === 'string' ? trialDaysOrBillingType : null;
  const trialDays = typeof trialDaysOrBillingType === 'number' ? trialDaysOrBillingType : 0;

  // For 50% off first 3 months: create a coupon then apply it
  let discounts: any[] | undefined;
  if (billingType === 'half3months') {
    const coupon = await stripe.coupons.create({
      percent_off: 50,
      duration: 'repeating',
      duration_in_months: 3,
      name: 'Torqued Launch - 50% off 3 months',
    });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    line_items: [{
      price_data: {
        currency: 'nzd',
        recurring: { interval: 'month' },
        product_data: { name: 'Torqued Garage Portal Subscription', description: 'Access to NZ-wide high-value repair marketplace leads' },
        unit_amount: 9900,
      },
      quantity: 1,
    }],
    ...(!billingType && trialDays > 0 ? { subscription_data: { trial_period_days: trialDays } } : {}),
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
    customerName, bookingId, date, time, readyTime, vehicle, plate,
    mechanicName, mechanicAddress, paymentMethod, services, price,
    paymentOption, promoApplied, promoDiscount,
  } = data;

  const finalPrice = promoApplied ? Math.max(0, parseFloat(price) - parseFloat(promoDiscount)) : parseFloat(price);
  const serviceRows = (services || []).map((s: string) => `
    <tr><td style="padding:10px 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #f0ede8;text-transform:uppercase;">${s}</td>
    <td style="padding:10px 0;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${EMAIL_MUTED};border-bottom:1px solid #f0ede8;">INCLUDED</td></tr>`).join('');
  const discountRow = promoApplied ? `<tr><td style="padding:8px 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_RED};">PROMO DISCOUNT</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-size:13px;font-weight:900;color:${EMAIL_RED};">-$${parseFloat(promoDiscount).toFixed(2)}</td></tr>` : '';

  return emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Booking Confirmed')}
${emailGreeting(customerName)}
${emailPara(`Your <strong>${vehicle}</strong> booking is confirmed. Reference: <strong style="color:${EMAIL_RED};">#${bookingId}</strong>`)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid #e8e4df;">
  <tr><td style="background:#f7f4f0;padding:14px 18px;">
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Vehicle</p>
    <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:14px;font-weight:700;color:${EMAIL_DARK};">${vehicle} <span style="font-family:monospace;font-size:12px;background:${EMAIL_RED};color:#fff;padding:2px 7px;border-radius:4px;margin-left:6px;">${plate}</span></p>
  </td></tr>
  <tr><td style="background:#fff;padding:14px 18px;border-top:1px solid #e8e4df;">
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Workshop</p>
    <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:14px;font-weight:700;color:${EMAIL_DARK};">${mechanicName}</p>
    <p style="margin:2px 0 0;font-family:${EMAIL_BODY_FONT};font-size:12px;color:${EMAIL_MUTED};">📍 ${mechanicAddress}</p>
  </td></tr>
  <tr><td style="background:#f7f4f0;padding:14px 18px;border-top:1px solid #e8e4df;">
    <table width="100%"><tr>
      <td width="50%" style="vertical-align:top;">
        <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Drop-off</p>
        <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">${date}</p>
        <p style="margin:2px 0 0;font-family:${EMAIL_BODY_FONT};font-size:16px;font-weight:900;color:${EMAIL_RED};">@ ${time}</p>
      </td>
      <td width="50%" style="vertical-align:top;">
        <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Estimated pick-up</p>
        <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">${readyTime}</p>
      </td>
    </tr></table>
  </td></tr>
</table>

<p style="margin:0 0 8px;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Services</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
  ${serviceRows}
  ${discountRow}
  <tr>
    <td style="padding:12px 0 6px;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">Total (incl. GST)</td>
    <td style="padding:12px 0 6px;text-align:right;font-family:monospace;font-size:18px;font-weight:900;color:${EMAIL_RED};">$${finalPrice.toFixed(2)}</td>
  </tr>
  <tr><td colspan="2"><span style="background:${EMAIL_DARK};color:#fff;padding:4px 10px;border-radius:6px;font-family:${EMAIL_BODY_FONT};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${paymentOption === 'deposit' ? 'Deposit paid' : 'Paid in full'} via ${paymentMethod}</span></td></tr>
</table>

</td></tr>`);
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

  const serviceRows = (services || []).map((s: string) => `
    <tr><td style="padding:10px 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #f0ede8;text-transform:uppercase;">🛠 ${s}</td>
    <td style="padding:10px 0;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${EMAIL_RED};border-bottom:1px solid #f0ede8;">REQUIRED</td></tr>`).join('');

  const finalPrice = promoApplied ? Math.max(0, parseFloat(price) - parseFloat(promoDiscount)) : parseFloat(price);

  return emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle(`New Job: #${bookingId}`)}
${emailGreeting(mechanicName)}
${emailPara(`A new booking has been assigned to your workshop. Payment is confirmed — please prepare for the drop-off below.`)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid #e8e4df;">
  <tr><td style="background:#f7f4f0;padding:14px 18px;">
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Vehicle</p>
    <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:14px;font-weight:700;color:${EMAIL_DARK};">${vehicle} <span style="font-family:monospace;font-size:12px;background:${EMAIL_RED};color:#fff;padding:2px 7px;border-radius:4px;margin-left:6px;">${plate}</span></p>
  </td></tr>
  <tr><td style="background:#fff;padding:14px 18px;border-top:1px solid #e8e4df;">
    <table width="100%"><tr>
      <td width="50%" style="vertical-align:top;">
        <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Drop-off</p>
        <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">${date}</p>
        <p style="margin:2px 0 0;font-family:${EMAIL_BODY_FONT};font-size:16px;font-weight:900;color:${EMAIL_RED};">@ ${time}</p>
      </td>
      <td width="50%" style="vertical-align:top;">
        <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Ready by</p>
        <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">${readyTime}</p>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f7f4f0;padding:14px 18px;border-top:1px solid #e8e4df;">
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Client</p>
    <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:14px;font-weight:700;color:${EMAIL_DARK};">${customerName}</p>
    <p style="margin:2px 0 0;font-family:${EMAIL_BODY_FONT};font-size:12px;color:${EMAIL_MUTED};">${data.email || ''}</p>
  </td></tr>
</table>

<p style="margin:0 0 8px;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Work required</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
  ${serviceRows}
  <tr>
    <td style="padding:12px 0 6px;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">Job value (incl. GST)</td>
    <td style="padding:12px 0 6px;text-align:right;font-family:monospace;font-size:18px;font-weight:900;color:${EMAIL_RED};">$${finalPrice.toFixed(2)}</td>
  </tr>
  <tr><td colspan="2"><span style="background:${EMAIL_DARK};color:#fff;padding:4px 10px;border-radius:6px;font-family:${EMAIL_BODY_FONT};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${paymentOption === 'deposit' ? 'Deposit paid' : 'Paid in full'} via ${paymentMethod}</span></td></tr>
</table>
</td></tr>`);
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

  return emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Drop-off in 12 Hours')}
${emailGreeting(customerName)}
${emailPara(`This is your 12-hour reminder for <strong>${vehicle}</strong> (Ref: <strong style="color:${EMAIL_RED};">#${bookingId}</strong>). You're all set — here's what you need to know.`)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid #e8e4df;">
  <tr><td style="background:#f7f4f0;padding:16px 18px;text-align:center;">
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Drop-off time</p>
    <p style="margin:6px 0 2px;font-family:${EMAIL_BODY_FONT};font-size:16px;font-weight:700;color:${EMAIL_DARK};">${date}</p>
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:24px;font-weight:900;color:${EMAIL_RED};">@ ${time}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:14px 18px;border-top:1px solid #e8e4df;">
    <p style="margin:0;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Workshop</p>
    <p style="margin:4px 0 0;font-family:${EMAIL_BODY_FONT};font-size:14px;font-weight:700;color:${EMAIL_DARK};">${mechanicName}</p>
    <p style="margin:2px 0 0;font-family:${EMAIL_BODY_FONT};font-size:12px;color:${EMAIL_MUTED};">📍 ${mechanicAddress}</p>
  </td></tr>
</table>

<div style="background:#f7f4f0;border-radius:12px;padding:16px 18px;">
  <p style="margin:0 0 8px;font-family:${EMAIL_BODY_FONT};font-size:10px;font-weight:700;color:${EMAIL_MUTED};text-transform:uppercase;letter-spacing:1px;">Checklist</p>
  <ul style="margin:0;padding-left:16px;font-family:${EMAIL_BODY_FONT};font-size:13px;color:#374151;line-height:1.7;">
    <li>Arrive at your booked drop-off time</li>
    <li>Leave special wheel lock nuts or service logbooks in your vehicle console</li>
  </ul>
</div>
</td></tr>`);
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

  return emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('12-Month Service Due')}
${emailGreeting(customerName)}
${emailPara(`It's time for your annual maintenance. We recommend a <strong>12-month service</strong> for your <strong>${vehicle} <span style="font-family:monospace;font-size:12px;background:${EMAIL_RED};color:#fff;padding:2px 6px;border-radius:4px;">${plate}</span></strong> to keep it running at its best.`)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f7f4f0;border-radius:12px;border:1px solid #e8e4df;">
  <tr><td style="padding:20px 18px;text-align:center;">
    <p style="margin:0 0 14px;font-family:${EMAIL_BODY_FONT};font-size:13px;font-weight:700;color:${EMAIL_DARK};">Book your next service with <strong>${mechanicName}</strong></p>
    <a href="https://torqued-psi.vercel.app" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Schedule Service</a>
  </td></tr>
</table>

<p style="margin:24px 0 0;font-family:${EMAIL_BODY_FONT};font-size:11px;color:${EMAIL_MUTED};text-align:center;">
  <a href="https://torqued-psi.vercel.app/unsubscribe?email=${encodeURIComponent(emailStr)}" style="color:${EMAIL_MUTED};text-decoration:underline;">Unsubscribe from service reminders</a>
</p>
</td></tr>`);
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
        const serviceIds: string[] = bookingData.serviceIds || [];
        const hasDiag = serviceIds.includes('diag_inspection');
        const hasNonDiag = serviceIds.some((s: string) => s !== 'diag_inspection');
        const baseFields = {
          customer_id: userId || null,
          mechanic_id: bookingData.mechanicId,
          vehicle_rego: bookingData.vehicleId || null,
          status: 'pending_payment',
          payment_status: 'pending',
          payment_method: bookingData.paymentMethod || null,
          date: bookingData.date || null,
          total_price: bookingData.totalPrice || 0,
          deposit_paid: bookingData.depositPaid ?? null,
          customer_name: bookingData.customerName || null,
          email: bookingData.email || customerEmail || null,
          description: bookingData.description || null,
        };
        if (hasDiag && hasNonDiag) {
          const repairId = crypto.randomUUID();
          const diagPrice = 99;
          const repairPrice = Math.max(0, (bookingData.totalPrice || 0) - diagPrice);
          const { error: e1 } = await supabase.from('bookings').upsert({ ...baseFields, id: bookingId, service_ids: ['diag_inspection'], total_price: diagPrice, transaction_id: bookingId }, { onConflict: 'id' });
          if (e1) console.error('[create-payment] Failed to persist diag booking:', e1.message);
          const { error: e2 } = await supabase.from('bookings').upsert({ ...baseFields, id: repairId, service_ids: serviceIds.filter((s: string) => s !== 'diag_inspection'), total_price: repairPrice, transaction_id: bookingId }, { onConflict: 'id' });
          if (e2) console.error('[create-payment] Failed to persist repair booking:', e2.message);
        } else {
          const { error } = await supabase.from('bookings').upsert({ ...baseFields, id: bookingId, service_ids: serviceIds }, { onConflict: 'id' });
          if (error) console.error('[create-payment] Failed to persist booking:', error.message);
        }
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
        source: isIOS ? 'ios' : 'web',
        userId: userId || ''
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
    // 'no_payment_required' = fully covered by a 100%-off promo code → still a confirmed booking.
    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';

    // Webhook fallback: confirm the booking here too, idempotently, so a paid job is
    // never left stuck on "Pending Payment" if the Stripe webhook is delayed/unconfigured.
    const bookingId = (session.metadata as any)?.bookingId;
    if (paid && bookingId) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const update: Record<string, any> = { payment_status: 'confirmed', status: 'booked', stripe_session_id: session.id };
        const stripePhone = session.customer_details?.phone;
        if (session.customer_details?.email) update.email = session.customer_details.email;
        if (session.customer_details?.name) update.customer_name = session.customer_details.name;
        if (stripePhone) update.customer_phone = stripePhone;
        try { await supabase.from('bookings').update(update).eq('id', bookingId); } catch (e) { console.warn('[verify-session] confirm failed:', (e as Error).message); }
        // Persist the Stripe-collected phone to the customer profile (system-wide, shareable with mechanics)
        if (stripePhone) {
          const uid = (session.metadata as any)?.userId;
          try {
            if (uid) await supabase.from('profiles').update({ phone: stripePhone }).eq('id', uid);
            else if (session.customer_details?.email) await supabase.from('profiles').update({ phone: stripePhone }).ilike('email', session.customer_details.email);
          } catch (e) { console.warn('[verify-session] phone sync failed:', (e as Error).message); }
        }
      }
    }

    res.json({
      status: paid ? 'succeeded' : 'pending',
      email: session.customer_details?.email || session.customer_email || null,
      name: session.customer_details?.name || null,
      phone: session.customer_details?.phone || null,
      bookingId: bookingId || null,
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

    // Enrich from the actual booking so the email never shows client placeholders
    // ("Your Workshop", "your mechanics address", etc.) — always real-world data.
    if (data.bookingId) {
      try {
        const ctx = await getBookingContext(data.bookingId);
        if (ctx.mechanicName) data.mechanicName = ctx.mechanicName;
        if (ctx.custName) data.customerName = ctx.custName;
        if (ctx.email && (!data.email || isPlaceholderEmail(data.email))) data.email = ctx.email;
        if (ctx.vehicleLabel && (!data.vehicle || /your/i.test(String(data.vehicle)))) data.vehicle = ctx.vehicleLabel;
        const sa = getSupabaseAdmin();
        if (sa && data.mechanicId) {
          const { data: mp } = await sa.from('profiles').select('name, address, phone').eq('id', data.mechanicId).maybeSingle();
          if (mp?.address) data.mechanicAddress = mp.address;
          if (mp?.name) data.mechanicName = mp.name;
          if (mp?.phone) data.mechanicPhone = mp.phone;
        }
      } catch (e) { console.warn('[confirm-booking] enrich failed:', (e as Error).message); }
    }
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

        // Dispatch Mechanic alert — only if a real mechanic email is known
        let mechanicEmailSent = '';
        const realMechanicEmail = data.mechanicEmail && !String(data.mechanicEmail).includes('@torqued-partner.co.nz')
          ? String(data.mechanicEmail).trim() : null;
        if (!realMechanicEmail && data.mechanicId) {
          // Look up real email from DB
          const sa = getSupabaseAdmin();
          if (sa) {
            const { data: mp } = await sa.from('profiles').select('email').eq('id', data.mechanicId).single();
            if (mp?.email) {
              await transporter.sendMail({
                from: fromAddress, to: mp.email,
                subject: `[New Torqued Booking] Ref #${data.bookingId} - ${data.vehicle} (${data.plate})`,
                html: mechanicHtml,
              });
              mechanicEmailSent = mp.email;
            }
          }
        } else if (realMechanicEmail) {
          await transporter.sendMail({
            from: fromAddress, to: realMechanicEmail,
            subject: `[New Torqued Booking] Ref #${data.bookingId} - ${data.vehicle} (${data.plate})`,
            html: mechanicHtml,
          });
          mechanicEmailSent = realMechanicEmail;
        }

        // NOTE: drop-off 12h reminder is NOT sent here — it fires via a scheduled cron
        // job when the booking is actually 12h away. Sending it immediately would be wrong.

        // NOTE: the 12-month service reminder is intentionally NOT sent here.
        // Scheduled reminders should only fire when actually due (future cron),
        // not on booking/registration.

        sentRealEmail = true;
        console.log(`Confirmation email sent to ${recipientEmail}${mechanicEmailSent ? ` + mechanic ${mechanicEmailSent}` : ''}`);
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


// ─────────────────────────────────────────────────────────────────────────────
// Cold Quote — Customer Service History Access (OTP flow)
// ─────────────────────────────────────────────────────────────────────────────

// ── Service-history access via a 12-HOUR LINK (replaces the one-time code) ──────
// POST /api/mechanic/request-history-link — email the owner a link they tap to grant
// this workshop 12 hours of access to their vehicle's service history.
app.post('/api/mechanic/request-history-link', async (req, res) => {
  try {
    const { mechanicId, rego, customerEmail } = req.body;
    if (!mechanicId || !rego) return res.status(400).json({ error: 'mechanicId and rego required' });
    const formattedRego = String(rego).toUpperCase().trim();
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    const { data: vehicle } = await supabase.from('vehicles').select('rego, owner_id, year, make, model').eq('rego', formattedRego).maybeSingle();

    // Resolve who to ask: the vehicle's owner, OR — when cold quoting (no prior link) —
    // the customer email the mechanic entered. Cold quoting IS the first connection.
    let ownerId: string | null = vehicle?.owner_id ?? null;
    let ownerEmail: string | null = null;
    if (!ownerId && customerEmail) {
      const { data: byEmail } = await supabase.from('profiles').select('id, email').ilike('email', String(customerEmail).trim()).maybeSingle();
      if (byEmail?.id) { ownerId = byEmail.id; ownerEmail = byEmail.email; }
      else ownerEmail = String(customerEmail).trim(); // no account yet — still email them the request
    }
    if (!ownerId && !ownerEmail) return res.json({ hasAccount: false });

    // Prior completed/active job → already entitled to history.
    const { data: prior } = await supabase.from('bookings').select('id').eq('mechanic_id', mechanicId).eq('vehicle_rego', formattedRego).in('status', ['completed', 'in_progress']).limit(1);
    if (prior && prior.length) return res.json({ hasAccount: true, priorBooking: true });

    // Reuse a still-valid pending link rather than spamming the owner.
    const { data: existing } = await supabase.from('history_access_links').select('token, expires_at').eq('mechanic_id', mechanicId).eq('rego', formattedRego).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).maybeSingle();
    if (existing) return res.json({ hasAccount: true, linkSent: true, alreadySent: true, expiresAt: existing.expires_at });

    if (!ownerEmail && ownerId) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
      ownerEmail = profile?.email ?? null;
    }
    if (!ownerEmail) return res.json({ hasAccount: true, noEmail: true });
    const { data: mechProfile } = await supabase.from('profiles').select('name').eq('id', mechanicId).single();

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error: insErr } = await supabase.from('history_access_links').insert({ token, mechanic_id: mechanicId, rego: formattedRego, owner_id: ownerId, granted: false, expires_at: expiresAt });
    if (insErr) { console.error('[request-history-link] insert:', insErr.message); return res.status(500).json({ error: 'Could not create access link.' }); }

    const origin = getOrigin(req);
    const link = `${origin}/customer?grant_history=${encodeURIComponent(token)}`;
    const vehicleLabel = `${vehicle?.year || ''} ${vehicle?.make || ''} ${vehicle?.model || ''}`.trim() || formattedRego;
    const mechName = mechProfile?.name || 'A Torqued workshop';
    const mailer = getMailTransporter();
    if (mailer) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: ownerEmail,
        subject: 'A workshop is requesting your vehicle service history',
        html: emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle('Share your service history?')}
${emailPara(`<strong>${mechName}</strong> would like to view the Torqued service history for your <strong>${vehicleLabel}</strong> (e.g. for a quote or pre-purchase inspection).`)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td>
  <a href="${link}" style="display:inline-block;background:${EMAIL_RED};color:#fff;font-family:${EMAIL_BODY_FONT};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:10px;">Grant 12-hour access</a>
</td></tr></table>
${emailPara('This link is valid for 12 hours. If you did not expect this request, you can ignore this email — no access is granted unless you tap the button.')}
</td></tr>`),
      }).catch(e => console.warn('History link email failed:', e?.message));
    }
    return res.json({ hasAccount: true, linkSent: true, expiresAt });
  } catch (err) {
    console.error('[request-history-link]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/history/grant — the vehicle owner taps the emailed link to grant access.
app.post('/api/history/grant', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });
    const { data: link } = await supabase.from('history_access_links').select('token, rego, expires_at, granted').eq('token', token).maybeSingle();
    if (!link) return res.status(404).json({ error: 'This link is invalid.' });
    if (new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'This link has expired.' });
    await supabase.from('history_access_links').update({ granted: true }).eq('token', token);
    res.json({ success: true, rego: link.rego });
  } catch (err) {
    console.error('[history/grant]', err);
    res.status(500).json({ error: 'Could not grant access' });
  }
});

// GET /api/mechanic/history-access-status — is access granted? If so, return the history.
app.get('/api/mechanic/history-access-status', async (req, res) => {
  try {
    const mechanicId = req.query.mechanicId as string;
    const rego = req.query.rego ? String(req.query.rego).toUpperCase().trim() : '';
    if (!mechanicId || !rego) return res.status(400).json({ error: 'mechanicId and rego required' });
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    // Granted via a still-valid link, OR an existing prior job with this workshop.
    const { data: granted } = await supabase.from('history_access_links').select('token').eq('mechanic_id', mechanicId).eq('rego', rego).eq('granted', true).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
    const { data: prior } = await supabase.from('bookings').select('id').eq('mechanic_id', mechanicId).eq('vehicle_rego', rego).in('status', ['completed', 'in_progress']).limit(1);
    if (!granted && !(prior && prior.length)) return res.json({ granted: false });

    const [{ data: imported }, { data: jobs }] = await Promise.all([
      supabase.from('vehicle_history').select('service_date, work_done, provider, mileage, price, notes').eq('rego', rego).order('service_date', { ascending: false }),
      supabase.from('bookings').select('date, completed_at, service_ids, quote_items, description, total_price, mileage_out, status').eq('vehicle_rego', rego).eq('status', 'completed').order('completed_at', { ascending: false }),
    ]);
    res.json({ granted: true, imported: imported ?? [], jobs: jobs ?? [] });
  } catch (err) {
    console.error('[history-access-status]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mechanic/request-history-access
// Called when mechanic enters a rego on cold quote and wants to see history.
// Returns: { hasAccount, priorBooking, otpSent, alreadySent, expiresAt }
app.post('/api/mechanic/request-history-access', async (req, res) => {
  try {
    const { mechanicId, rego } = req.body;
    if (!mechanicId || !rego) return res.status(400).json({ error: 'mechanicId and rego required' });
    const formattedRego = String(rego).toUpperCase().trim();

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    // Find vehicle + owner
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('rego, owner_id')
      .eq('rego', formattedRego)
      .single();

    if (!vehicle?.owner_id) {
      return res.json({ hasAccount: false });
    }

    const customerId = vehicle.owner_id;

    // Step 7: check for prior booking between this mechanic and this vehicle
    const { data: priorBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('mechanic_id', mechanicId)
      .eq('vehicle_rego', formattedRego)
      .in('status', ['completed', 'in_progress'])
      .limit(1);

    if (priorBookings && priorBookings.length > 0) {
      return res.json({ hasAccount: true, priorBooking: true });
    }

    // Check for existing unexpired OTP for this mechanic/vehicle
    const { data: existing } = await supabase
      .from('history_access_otps')
      .select('id, expires_at, created_at')
      .eq('mechanic_id', mechanicId)
      .eq('vehicle_rego', formattedRego)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Check 4-minute re-request throttle (codes expire in 5 minutes)
      const createdAt = new Date(existing.created_at).getTime();
      const throttleCutoff = Date.now() - 4 * 60 * 1000;
      if (createdAt > throttleCutoff) {
        return res.json({ hasAccount: true, alreadySent: true, expiresAt: existing.expires_at });
      }
    }

    // Get customer email (do not expose it)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', customerId)
      .single();

    if (!profile?.email) {
      return res.json({ hasAccount: true, noEmail: true });
    }

    // Get mechanic name for the email
    const { data: mechProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', mechanicId)
      .single();

    // Get vehicle details for the email
    const { data: vehData } = await supabase
      .from('vehicles')
      .select('year, make, model')
      .eq('rego', formattedRego)
      .single();

    const vehicleLabel = vehData
      ? `${vehData.year || ''} ${vehData.make || ''} ${vehData.model || ''}`.trim()
      : formattedRego;

    // Generate 6-digit OTP, hash before storage
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5-minute window

    // Invalidate any previous unused OTPs for this mechanic/vehicle
    await supabase
      .from('history_access_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('mechanic_id', mechanicId)
      .eq('vehicle_rego', formattedRego)
      .is('used_at', null);

    // Store new OTP
    const { error: insertErr } = await supabase.from('history_access_otps').insert({
      mechanic_id: mechanicId,
      customer_id: customerId,
      vehicle_rego: formattedRego,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });
    if (insertErr) {
      console.error('[request-history-otp] insert failed:', insertErr.message);
      return res.status(500).json({ error: 'Could not generate code. Please try again.' });
    }

    // Send email to customer
    const mailer = getMailTransporter();
    if (mailer) {
      const mechName = mechProfile?.name || 'A mechanic';
      await mailer.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: profile.email,
        subject: 'Someone is requesting access to your vehicle\'s service history',
        html: `
          <div style="font-family:Arial,sans-serif;background:#f9f9f9;padding:32px;">
            <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
              <div style="background:#150402;padding:24px 28px;">
                <img src="${LOGO_URL}" alt="Torqued" style="height:36px;" />
              </div>
              <div style="padding:28px;">
                <p style="font-size:15px;color:#111;margin-bottom:16px;">${mechName} on Torqued is preparing a quote for your <strong>${vehicleLabel}</strong> and has requested access to your vehicle's service history.</p>
                <p style="font-size:15px;color:#111;margin-bottom:8px;">If you want to share your service history with this mechanic, give them this code:</p>
                <div style="background:#150402;border-radius:12px;padding:20px 28px;text-align:center;margin:20px 0;">
                  <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#ff1800;font-family:monospace;">${otp}</span>
                </div>
                <p style="font-size:13px;color:#6b7280;margin-top:8px;">This code expires in 5 minutes. If you did not expect this request or do not wish to share your history, you can ignore this email — no access will be granted without the code.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
                <p style="font-size:11px;color:#9ca3af;">Torqued NZ · torqued.nz@icloud.com · If you have questions, reply to this email.</p>
              </div>
            </div>
          </div>
        `,
      });
    }

    return res.json({ hasAccount: true, otpSent: true, expiresAt });
  } catch (err) {
    console.error('[request-history-access]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mechanic/verify-history-otp
// Validates the OTP and returns service history if correct
app.post('/api/mechanic/verify-history-otp', async (req, res) => {
  try {
    const { mechanicId, rego, otp } = req.body;
    if (!mechanicId || !rego || !otp) return res.status(400).json({ error: 'mechanicId, rego, otp required' });
    const formattedRego = String(rego).toUpperCase().trim();
    const otpHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    const { data: record, error: lookupErr } = await supabase
      .from('history_access_otps')
      .select('id, customer_id, expires_at, used_at')
      .eq('mechanic_id', mechanicId)
      .eq('vehicle_rego', formattedRego)
      .eq('otp_hash', otpHash)
      .single();

    if (lookupErr) console.error('[verify-history-otp] lookup error:', lookupErr.message);
    if (!record) return res.status(401).json({ error: 'Invalid code. Please check and try again.' });
    if (record.used_at) return res.status(401).json({ error: 'This code has already been used.' });
    if (new Date(record.expires_at) < new Date()) return res.status(401).json({ error: 'This code has expired. Please request a new one.' });

    // Mark as used
    await supabase.from('history_access_otps').update({ used_at: new Date().toISOString() }).eq('id', record.id);

    // Load service history
    const { data: imported } = await supabase
      .from('service_history')
      .select('service_date, work_done, provider, mileage, price, notes')
      .eq('vehicle_rego', formattedRego)
      .order('service_date', { ascending: false });

    const { data: torquedJobs } = await supabase
      .from('bookings')
      .select('date, service_ids, total_price, status, created_at')
      .eq('vehicle_rego', formattedRego)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    // Send confirmation email to customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', record.customer_id)
      .single();

    const { data: vehData } = await supabase
      .from('vehicles')
      .select('year, make, model')
      .eq('rego', formattedRego)
      .single();

    const vehicleLabel = vehData
      ? `${vehData.year || ''} ${vehData.make || ''} ${vehData.model || ''}`.trim()
      : formattedRego;

    if (profile?.email) {
      const mailer = getMailTransporter();
      if (mailer) {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
          to: profile.email,
          subject: 'Your vehicle service history was accessed on Torqued',
          html: `
            <div style="font-family:Arial,sans-serif;background:#f9f9f9;padding:32px;">
              <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                <div style="background:#150402;padding:24px 28px;">
                  <img src="${LOGO_URL}" alt="Torqued" style="height:36px;" />
                </div>
                <div style="padding:28px;">
                  <p style="font-size:15px;color:#111;margin-bottom:12px;">This is to let you know that a mechanic on Torqued has accessed the service history for your <strong>${vehicleLabel}</strong> to prepare a quote.</p>
                  <p style="font-size:14px;color:#6b7280;">If you have questions about this, contact us at <a href="mailto:torqued.nz@icloud.com" style="color:#ff1800;">torqued.nz@icloud.com</a>.</p>
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
                  <p style="font-size:11px;color:#9ca3af;">Torqued NZ · torqued.nz@icloud.com</p>
                </div>
              </div>
            </div>
          `,
        });
      }
    }

    return res.json({
      granted: true,
      history: {
        imported: imported || [],
        torquedJobs: torquedJobs || [],
      },
    });
  } catch (err) {
    console.error('[verify-history-otp]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/mechanic/history-direct?mechanicId=&rego=
// Used when prior booking exists — skip OTP and load history directly
app.get('/api/mechanic/history-direct', async (req, res) => {
  try {
    const { mechanicId, rego } = req.query as { mechanicId: string; rego: string };
    if (!mechanicId || !rego) return res.status(400).json({ error: 'mechanicId and rego required' });
    const formattedRego = rego.toUpperCase().trim();

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    // Re-verify prior booking (security check)
    const { data: prior } = await supabase
      .from('bookings')
      .select('id')
      .eq('mechanic_id', mechanicId)
      .eq('vehicle_rego', formattedRego)
      .in('status', ['completed', 'in_progress'])
      .limit(1);

    if (!prior || prior.length === 0) {
      return res.status(403).json({ error: 'No prior booking authorisation' });
    }

    const { data: imported } = await supabase
      .from('service_history')
      .select('service_date, work_done, provider, mileage, price, notes')
      .eq('vehicle_rego', formattedRego)
      .order('service_date', { ascending: false });

    const { data: torquedJobs } = await supabase
      .from('bookings')
      .select('date, service_ids, total_price, status, created_at')
      .eq('vehicle_rego', formattedRego)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    return res.json({ granted: true, history: { imported: imported || [], torquedJobs: torquedJobs || [] } });
  } catch (err) {
    console.error('[history-direct]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Privacy Act & AI Controls
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/privacy-request — log a privacy act request
app.post('/api/admin/privacy-request', async (req, res) => {
  try {
    if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' });
    const { customerEmail, requestType, notes } = req.body;
    if (!customerEmail || !requestType) return res.status(400).json({ error: 'customerEmail and requestType required' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    const { error } = await supabase.from('privacy_requests').insert({
      customer_email: String(customerEmail).trim().toLowerCase(),
      request_type: requestType,
      notes: notes || null,
      status: 'pending',
    });

    if (error) {
      // Table may not exist yet — create it lazily via raw SQL
      // Table doesn't exist yet — insert will fail gracefully; admin should create table in Supabase
      await supabase.from('privacy_requests').insert({
        customer_email: String(customerEmail).trim().toLowerCase(),
        request_type: requestType,
        notes: notes || null,
        status: 'pending',
      });
    }

    // If delete request: soft-delete customer data in profiles
    if (requestType === 'delete') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', String(customerEmail).trim())
        .maybeSingle();
      if (profile) {
        await supabase.from('profiles').update({
          name: '[Deleted]',
          email: `deleted_${profile.id}@torqued.nz`,
          phone: null,
        }).eq('id', profile.id);
        // Vehicles and service history are retained per legal requirement
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[privacy-request]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/privacy-requests — list all requests
app.get('/api/admin/privacy-requests', async (req, res) => {
  try {
    if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    const { data, error } = await supabase
      .from('privacy_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.json({ requests: [] });
    res.json({ requests: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/resolve-privacy-request
app.post('/api/admin/resolve-privacy-request', async (req, res) => {
  try {
    if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' });
    const { id, resolvedBy } = req.body;

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    await supabase.from('privacy_requests').update({
      status: 'resolved',
      resolved_by: resolvedBy || 'admin',
      resolved_at: new Date().toISOString(),
    }).eq('id', id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/toggle-customer-ai — disable/enable AI features for a customer
// reason: 'request' (customer asked — email them) | 'ban' (misuse — no email, silent)
app.post('/api/admin/toggle-customer-ai', async (req, res) => {
  try {
    if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' });
    const { customerEmail, disabled, reason } = req.body;
    const isBan = reason === 'ban';

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name')
      .ilike('email', String(customerEmail).trim())
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Customer not found — check they have a Torqued account.' });

    const update: Record<string, any> = { ai_disabled: !!disabled };
    // Try to persist reason; silently ignore if the column doesn't exist yet
    if (disabled) update.ai_disable_reason = isBan ? 'ban' : 'request';
    else update.ai_disable_reason = null;

    const { error: updateErr } = await supabase.from('profiles').update(update).eq('id', profile.id);
    if (updateErr) {
      // Retry without reason column if it doesn't exist
      const { error: retryErr } = await supabase.from('profiles').update({ ai_disabled: !!disabled }).eq('id', profile.id);
      if (retryErr) return res.status(500).json({ error: 'Could not update AI status — the ai_disabled column may not exist yet. Run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_disabled boolean DEFAULT false;' });
    }

    // Only email the customer when disabling by request, or when re-enabling
    const mailer = getMailTransporter();
    if (mailer && !isBan) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || '"Torqued" <torquedapp.nz@gmail.com>',
        to: profile.email,
        subject: disabled
          ? 'Your AI features on Torqued have been paused'
          : 'Your AI features on Torqued have been re-enabled',
        html: emailWrap(`<tr><td style="padding:36px 32px;">
${emailTitle(disabled ? 'AI features paused' : 'AI features re-enabled')}
${emailGreeting(profile.name)}
${disabled
  ? emailPara(`You have requested that AI-powered features be paused on your Torqued account. This includes AI service recommendations, vehicle health analysis, and AI-assisted receipt scanning.`) +
    emailPara(`To re-enable AI features, please contact us at <a href="mailto:torqued.nz@icloud.com" style="color:${EMAIL_RED};">torqued.nz@icloud.com</a>.`)
  : emailPara(`AI-powered features have been re-enabled on your Torqued account. You can now access AI service recommendations, vehicle health analysis, and AI-assisted receipt scanning.`)
}
</td></tr>`),
      }).catch(() => {});
    }

    res.json({ success: true, ai_disabled: !!disabled, reason: isBan ? 'ban' : 'request' });
  } catch (err) {
    console.error('[toggle-customer-ai]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/customer-ai-status?key=&email= — check AI status for a customer
app.get('/api/admin/customer-ai-status', async (req, res) => {
  try {
    if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' });
    const { email } = req.query as { email: string };

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    // Try with ai_disabled first; fall back if column doesn't exist yet
    let { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, ai_disabled')
      .ilike('email', String(email).trim())
      .maybeSingle();

    if (error) {
      const fb = await supabase.from('profiles').select('id, name, email').ilike('email', String(email).trim()).maybeSingle();
      data = fb.data ? { ...fb.data, ai_disabled: false } : null;
    }

    if (!data) return res.status(404).json({ error: 'Customer not found — check they have a Torqued account.' });
    res.json({ id: data.id, name: data.name, email: data.email, ai_disabled: data.ai_disabled ?? false });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customer/mechanic-access?ownerId=&regos= — mechanics derived from actual bookings
app.get('/api/customer/mechanic-access', async (req, res) => {
  try {
    const ownerId = req.query.ownerId as string;
    const regos = (req.query.regos as string || '').split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.json({ mechanics: [] });

    // Pull all bookings for this customer (by ownerId or regos)
    let q = supabase.from('bookings')
      .select('id, mechanic_id, vehicle_rego, service_ids, created_at, date, description')
      .not('status', 'in', '(cancelled,declined)')
      .order('created_at', { ascending: false });
    if (ownerId) q = q.eq('owner_id', ownerId);
    else if (regos.length) q = q.in('vehicle_rego', regos);
    else return res.json({ mechanics: [] });

    const { data: bookings } = await q;
    if (!bookings?.length) return res.json({ mechanics: [] });

    // Group by mechanic_id
    const byMechanic: Record<string, any[]> = {};
    for (const b of bookings) {
      if (!b.mechanic_id) continue;
      if (!byMechanic[b.mechanic_id]) byMechanic[b.mechanic_id] = [];
      byMechanic[b.mechanic_id].push(b);
    }

    const mechanicIds = Object.keys(byMechanic);
    if (!mechanicIds.length) return res.json({ mechanics: [] });

    // Active revocations for this customer (by ownerId and/or per-rego refs).
    const refs: string[] = [];
    if (ownerId) refs.push(String(ownerId));
    for (const r of regos) refs.push(`rego:${r}`);
    let revokedAtByMechanic: Record<string, string> = {};
    if (refs.length) {
      const { data: revs } = await supabase.from('mechanic_access_revocations')
        .select('mechanic_id, revoked_at')
        .in('customer_ref', refs)
        .in('mechanic_id', mechanicIds);
      for (const rv of (revs || [])) {
        // Keep the most recent revocation per mechanic across refs
        if (!revokedAtByMechanic[rv.mechanic_id] || rv.revoked_at > revokedAtByMechanic[rv.mechanic_id]) {
          revokedAtByMechanic[rv.mechanic_id] = rv.revoked_at;
        }
      }
    }

    const { data: profiles } = await supabase.from('mechanic_profiles')
      .select('id, name, address, phone')
      .in('id', mechanicIds);

    const result = mechanicIds.map(mid => {
      const jobs = byMechanic[mid];
      // jobs are ordered created_at desc — jobs[0] is the most recent.
      const latestBooking = jobs[0].created_at;
      const revokedAt = revokedAtByMechanic[mid];
      // Hidden if revoked AND no new booking happened after the revocation.
      if (revokedAt && latestBooking <= revokedAt) return null;
      const profile = profiles?.find((p: any) => p.id === mid);
      const firstAccess = jobs.reduce((earliest: string, j: any) => j.created_at < earliest ? j.created_at : earliest, jobs[0].created_at);
      const vehicles = [...new Set(jobs.map((j: any) => j.vehicle_rego).filter(Boolean))];
      const serviceSet = new Set<string>();
      for (const j of jobs) (j.service_ids || []).forEach((s: string) => serviceSet.add(s));
      return {
        mechanicId: mid,
        mechanicName: profile?.name || 'Workshop',
        mechanicAddress: profile?.address || null,
        mechanicPhone: profile?.phone || null,
        accessStarted: firstAccess,
        vehicles,
        bookingCount: jobs.length,
        dataTypes: ['Booking history', ...(serviceSet.size > 0 ? ['Service records'] : []), 'Vehicle details'],
      };
    }).filter(Boolean);

    res.json({ mechanics: result });
  } catch (err) {
    console.error('[mechanic-access]', err);
    res.json({ mechanics: [] });
  }
});

// POST /api/customer/mechanic-access/revoke — revoke a mechanic's access to this customer's data.
// Identified by ownerId (logged-in) and/or regos (plate-verified). Access is re-granted automatically
// if the customer books / requests another quote with that mechanic after the revocation.
app.post('/api/customer/mechanic-access/revoke', async (req, res) => {
  try {
    const { mechanicId, ownerId, regos } = req.body as { mechanicId?: string; ownerId?: string; regos?: string | string[] };
    if (!mechanicId) return res.status(400).json({ error: 'mechanicId required' });

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    // Build the customer reference key(s): owner_id for logged-in users, else one per rego.
    const refs: string[] = [];
    if (ownerId) refs.push(String(ownerId));
    const regoList = Array.isArray(regos) ? regos : String(regos || '').split(',');
    for (const r of regoList.map(x => x.trim().toUpperCase()).filter(Boolean)) refs.push(`rego:${r}`);
    if (!refs.length) return res.status(400).json({ error: 'ownerId or regos required' });

    const now = new Date().toISOString();
    const rows = refs.map(customer_ref => ({ customer_ref, mechanic_id: mechanicId, revoked_at: now }));
    const { error } = await supabase.from('mechanic_access_revocations')
      .upsert(rows, { onConflict: 'customer_ref,mechanic_id' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('[mechanic-access/revoke]', err);
    res.status(500).json({ error: 'Server error' });
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
