import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = 3000;

// Capture raw body for Stripe webhook signature verification
app.use(express.json({
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
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
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
            <span style="font-size:26px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-1px;">TORQ<span style="color:#FF1800;">UED</span></span>
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

// POST /api/ai/fault-code — translates a diagnostic fault code using Gemini
app.post('/api/ai/fault-code', async (req, res) => {
  try {
    const { code, make, model, year, mileage } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ translation: `Interpreting ${code.toUpperCase()}... AI not configured.` });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a concise automotive diagnostic assistant for New Zealand mechanics.
Translate fault code ${code.toUpperCase()} for a ${year || ''} ${make || ''} ${model || ''} at ${mileage || 'unknown'} km.
In 1-2 sentences max: what it means, the most likely cause for this vehicle, and what action to take.
Be direct and practical. No disclaimers.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    res.json({ translation: response.text?.trim() || 'Unable to interpret code.' });
  } catch (err) {
    console.error('[AI fault-code]', err);
    res.status(500).json({ error: 'AI translation failed' });
  }
});

// POST /api/otp/send — looks up plate owner, generates and emails OTP
app.post('/api/otp/send', async (req, res) => {
  try {
    const { rego } = req.body;
    if (!rego) return res.status(400).json({ error: 'rego is required' });
    const formattedRego = (rego as string).toUpperCase().trim();

    // Resolve owner email — server-side so it is never exposed to client
    let ownerEmail: string | null = null;
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('rego', formattedRego)
        .single();
      if (vehicle?.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', vehicle.owner_id)
          .single();
        ownerEmail = profile?.email ?? null;
      }
    }

    // Fallback for demo plate
    if (!ownerEmail && formattedRego === 'RAH190') {
      ownerEmail = 'torquedapp.nz@gmail.com';
    }

    if (!ownerEmail) {
      return res.status(404).json({ error: 'Plate not found in registry' });
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

    res.json({ success: true, maskedEmail: maskEmail(ownerEmail) });
  } catch (err) {
    console.error('[OTP send]', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/otp/verify — validates code and clears it from store
app.post('/api/otp/verify', (req, res) => {
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
  res.json({ success: true });
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
                    <span style="font-family: 'Syne', -apple-system, Arial, sans-serif; font-size: 30px; font-weight: 900; letter-spacing: -1.2px; color: #ffffff; text-transform: uppercase; display: inline-block;">
                      TORQ<span style="color: #FF1800;">UED</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.5); letter-spacing: 2px; text-transform: uppercase;">
                      DUNEDIN HIGH-PERFORMANCE MARKETPLACE
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

          <!-- HELPFUL LOGISTICS FOR DUNEDIN ROADS -->
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
                torquedapp.nz@gmail.com • (0800) TORQUED-NZ
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
                    <span style="font-family: -apple-system, Arial, sans-serif; font-size: 26px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: -1px;">
                      TORQ<span style="color: #FF1800;">UED</span> <span style="font-size: 14px; font-weight: normal; color: rgba(255,255,255,0.6); margin-left: 8px;">PARTNER HUB</span>
                    </span>
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
                NEW DUNEDIN JOB DISPATCH: #${bookingId}
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

          <!-- OVERNIGHT DROP STATIONS -->
          <tr>
            <td style="padding: 20px 32px 10px 32px;">
              <div style="background-color: rgba(255, 24, 0, 0.04); border: 1px dashed rgba(255, 24, 0, 0.3); border-radius: 16px; padding: 18px; text-align: left;">
                <p style="margin: 0 0 4px 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #FF1800; text-transform: uppercase;">🔒 SECURITY VAULT INSTRUCTION</p>
                <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: rgba(255,255,255,0.8); line-height: 1.4;">
                  Please ensure your overnight dropbox code is calibrated. The client has been provided secure dropbox credentials. The code <strong>9944</strong> is reserved for dropoff envelopes on this job.
                </p>
              </div>
            </td>
          </tr>

          <!-- SIGNATURE SIGN-OFF -->
          <tr>
            <td style="padding: 10px 32px 28px 32px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 15px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="60%">
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; color: rgba(255,255,255,0.45); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Automated Clearance Dispatch Authority</p>
                    <p style="margin: 3px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 12.5px; color: #ffffff; font-weight: bold;">Torqued Otago Field Manager</p>
                  </td>
                  <td width="40%" style="text-align: right; vertical-align: middle;">
                    <div style="display: inline-block; padding: 4px 10px; border: 1px solid #FF1800; border-radius: 6px; font-family: 'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif; font-size: 19px; color: #FF1800; font-weight: bold; transform: rotate(-3deg);">
                      Dean Robinson
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTACT FOOTER -->
          <tr>
            <td style="background-color: #050100; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; color: rgba(255,255,255,0.45); font-weight: 500;">
                Questions? Otago Operational Logistics Hub: crew@torqued.nz or (0800) TORQUED-NZ
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
              <span style="font-family: -apple-system, Arial, sans-serif; font-size: 26px; font-weight: 900; color: #ffffff; text-transform: uppercase;">
                TORQ<span style="color: #FF1800;">UED</span>
              </span>
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
                <li style="margin-bottom: 6px;">Arrive on time or use the overnight secure <strong>key drop-box</strong>.</li>
                <li style="margin-bottom: 6px;">If dropping after-hours, drop keys in the secure vault using code: <strong>9944</strong>.</li>
                <li style="margin-bottom: 6px;">Leave special wheel lock nuts or service logbooks in your vehicle console.</li>
              </ul>
            </td>
          </tr>

          <!-- DIGITAL AUTHORIZATION -->
          <tr>
            <td style="padding: 10px 32px 28px 32px; border-top: 1px solid rgba(21,4,2,0.05);">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; color: rgba(21,4,2,0.4); text-transform: uppercase; font-weight: bold;">Authorized Dispatch</p>
                    <p style="margin: 2px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #150402; font-weight: bold;">Torqued Digital Dispatch Assistant</p>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <div style="font-family: 'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif; font-size: 16px; color: #ff1800; transform: rotate(-3deg); font-weight: bold; display: inline-block; padding: 2px 6px;">
                      Torqued Core
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTACT -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; text-align: center; border-top: 1px solid rgba(21,4,2,0.04); background-color: rgba(21, 4, 2, 0.015);">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; font-weight: bold; color: rgba(21,4,2,0.4); letter-spacing: 1px; text-transform: uppercase;">SUPPORT & LOGISTICS</p>
              <p style="margin: 3px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 11px; font-weight: bold; color: #FF1800;">(0800) TORQUED-NZ • torquedapp.nz@gmail.com</p>
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
              <span style="font-family: -apple-system, Arial, sans-serif; font-size: 28px; font-weight: 950; color: #ffffff; text-transform: uppercase; letter-spacing: -1px;">
                TORQ<span style="color: #FF1800;">UED</span>
              </span>
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
                G'day ${customerName}, Otago seasonal road adjustments are starting. Under Otago's high humidity and cold winters, we recommend a <strong>12-month dual-clutch transmission (DCT) mechatronics calibration</strong> for your <strong>${vehicle} (${plate})</strong> to ensure perfect shift pressures.
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

          <!-- WET SIGNATURE FIELD -->
          <tr>
            <td style="padding: 10px 32px 28px 32px; border-top: 1px solid rgba(255,255,255,0.05);">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="60%">
                    <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 9.5px; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: bold;">Performance Operations Lead</p>
                    <p style="margin: 2px 0 0 0; font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: rgba(255,255,255,0.8); font-weight: bold;">Torqued Otago Field Manager</p>
                  </td>
                  <td width="40%" style="text-align: right; vertical-align: middle;">
                    <div style="font-family: 'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif; font-size: 18px; color: #FF1800; transform: rotate(-4deg); font-weight: bold; display: inline-block; padding: 2px 8px;">
                      Dean Robinson
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER WITH SERVICE UN-SUBSCRIBE CONTROL (REQUIRED BY NZ CAN-SPAM COMPLIANCE) -->
          <tr>
            <td style="background-color: #050100; padding: 30px 32px; text-align: center; border-top: 1px solid rgba(255,255,255,0.03);">
              <p style="margin: 0; font-family: -apple-system, Arial, sans-serif; font-size: 10px; color: rgba(255,255,255,0.4); line-weight: 1.4;">
                This communication is generated through Torqued Otago Field Operations. All advisory bulletins are aligned with New Zealand manufacturer standards.
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
    const smsText = `TORQUED DUNEDIN: Booking Ref #${data.bookingId} is confirmed at ${data.mechanicName}! Drop off your vehicle (${data.vehicle} - ${data.plate}) on ${data.date} at ${data.time} at ${data.mechanicAddress}. Overnight lock-box passcode is 9944.`;

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
        subject = `⚙️ [Torqued Hub Test] LIVE Otago Workshop Dispatch: Ref #${finalData.bookingId}`;
        break;
      case 'dropoff':
        html = generateDropoffReminderEmailHtml(finalData);
        subject = `⏰ [Torqued NZ Test] Live Reminder: Drop-off in 12 Hours`;
        break;
      case 'service':
        html = generateServiceReminderEmailHtml(finalData);
        subject = `🔧 [Torqued Service Advisory Test] Scheduled DCT Calibration Reminder`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid templateType' });
    }

    const SMS = `TORQUED DUNEDIN TEST: Booking Ref #${finalData.bookingId} is confirmed for vehicle (${finalData.vehicle} - ${finalData.plate}). Drop off time: ${finalData.time}! Passcode: 9944.`;

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
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
