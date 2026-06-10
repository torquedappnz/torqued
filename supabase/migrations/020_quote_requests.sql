-- ============================================================
-- TORQUED — Migration 020: Quote Requests (fallback flow)
-- Stores requests where instant pricing was unavailable.
-- The edge function handle_manual_quote_request processes these.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_requests (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid references vehicle_models(id),  -- null if vehicle not found in fleet
  carjam_plate   text,
  carjam_make    text,
  carjam_model   text,
  carjam_year    integer,
  category_id    integer references part_categories(id),
  customer_email text not null,
  customer_name  text,
  range_low      numeric,
  range_high     numeric,
  status         text default 'pending'
                 check (status in ('pending','sent','closed')),
  created_at     timestamptz default now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quote_requests' AND relrowsecurity = true) THEN
    ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Anon/public can insert their own quote request (public-facing form)
DROP POLICY IF EXISTS "quote_requests_anon_insert" ON quote_requests;
CREATE POLICY "quote_requests_anon_insert" ON quote_requests
  FOR INSERT WITH CHECK (true);

-- Service role can read and update all rows (for the edge function)
DROP POLICY IF EXISTS "quote_requests_service_select" ON quote_requests;
CREATE POLICY "quote_requests_service_select" ON quote_requests
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "quote_requests_service_update" ON quote_requests;
CREATE POLICY "quote_requests_service_update" ON quote_requests
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');
