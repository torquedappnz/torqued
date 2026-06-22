-- ============================================================
-- TORQUED — Migration 035: Security hardening
-- Fixes Supabase Security Advisor warnings:
--   1. handle_new_user: fix search_path + revoke public execute
--   2. resolve_part_price: fix search_path
--   3. quote_requests anon insert: scope to non-null email
--   4. Enable leaked password protection (done via dashboard/API, noted here)
-- ============================================================

-- -------------------------------------------------------
-- 1. handle_new_user — pin search_path, revoke public execute
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'signup_role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Revoke direct invocation from public/authenticated roles
-- (trigger-only function — nobody should call it directly)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

-- -------------------------------------------------------
-- 2. resolve_part_price — pin search_path
-- Must DROP first because OUT parameter names differ from live version
-- -------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_part_price(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.resolve_part_price(
  p_mechanic_id uuid,
  p_vehicle_id  uuid,
  p_category_id int
)
RETURNS TABLE (
  total_job_low   numeric,
  total_job_high  numeric,
  hours_low       numeric,
  hours_high      numeric,
  price_source    text,
  confidence      integer,
  is_verified     boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_family_id text;
  v_string_id text;
BEGIN
  SELECT fv.engine_family_id, fv.vehicle_id
    INTO v_family_id, v_string_id
    FROM vehicle_models vm
    JOIN fleet_vehicles fv
      ON fv.make = vm.make
     AND fv.model = vm.model
     AND fv.year_from <= vm.year_from
     AND (fv.year_to IS NULL OR fv.year_to >= COALESCE(vm.year_to, vm.year_from))
    WHERE vm.id = p_vehicle_id
    ORDER BY fv.year_from DESC
    LIMIT 1;

  IF v_family_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      ep.total_job_low::numeric,
      ep.total_job_high::numeric,
      ep.hours_low,
      ep.hours_high,
      'ef_' || ep.engine_family_id AS price_source,
      ep.confidence,
      false AS is_verified
    FROM ef_parts_data ep
    WHERE ep.engine_family_id = v_family_id
      AND ep.category_id = p_category_id;

    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(o.part_cost, p.part_cost_low)::numeric,
    COALESCE(o.part_cost, p.part_cost_high)::numeric,
    COALESCE(o.labour_hours, l.hours_low),
    COALESCE(o.labour_hours, l.hours_high),
    CASE WHEN o.id IS NOT NULL THEN 'mechanic_inventory'
         ELSE p.source::text END,
    p.confidence::integer,
    (o.id IS NOT NULL OR p.source = 'mechanic_verified')
  FROM parts_data p
  LEFT JOIN labour_times l
    ON l.vehicle_id = p.vehicle_id AND l.category_id = p.category_id
  LEFT JOIN mechanic_part_overrides o
    ON o.mechanic_id = p_mechanic_id
   AND o.vehicle_id  = p.vehicle_id
   AND o.category_id = p.category_id
  WHERE p.vehicle_id  = p_vehicle_id
    AND p.category_id = p_category_id;
END;
$$;

-- -------------------------------------------------------
-- 3. quote_requests anon insert — tighten from WITH CHECK (true)
--    Public can insert only when email is present (basic non-null guard).
--    Server-side validation still enforces full format.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "quote_requests_anon_insert" ON public.quote_requests;
CREATE POLICY "quote_requests_anon_insert" ON public.quote_requests
  FOR INSERT
  WITH CHECK (customer_email IS NOT NULL AND customer_email <> '');

-- -------------------------------------------------------
-- 4. Leaked password protection
--    Cannot be set via SQL — enable in Supabase Dashboard:
--    Authentication → Settings → "Enable leaked password protection"
-- -------------------------------------------------------
