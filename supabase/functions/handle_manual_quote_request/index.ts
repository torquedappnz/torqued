import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// STUB — logs the incoming payload only.
// Wire real email logic here once the quote_requests table is populated in prod.
serve(async (req) => {
  try {
    const payload = await req.json();
    console.log('[handle_manual_quote_request] received:', JSON.stringify(payload, null, 2));

    return new Response(
      JSON.stringify({ ok: true, message: 'stub: payload logged' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('[handle_manual_quote_request] error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
