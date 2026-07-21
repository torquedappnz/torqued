SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 066: vehicle_models cleanup
-- 1. Delete exact-duplicate rows (migration 064's backfill missed rows
--    stored under combined JDM model names, inserting 257 duplicates —
--    NULL engine_code bypasses the unique constraint).
-- 2. Delete extended-model rows ("Golf GTE", "Passat GTE"...) redundant
--    with an equivalent base-model row (same make/fuel/cc, overlapping years).
-- 3. Correct timing_drive where it contradicts the vehicle's engine family.
-- Applied directly to production 2026-07-21.
-- ============================================================

-- 1. exact dupes: keep the oldest row of each logical tuple
DELETE FROM public.vehicle_models d USING public.vehicle_models k
WHERE d.id <> k.id AND d.created_at > k.created_at
  AND lower(d.make) = lower(k.make) AND lower(d.model) = lower(k.model)
  AND coalesce(lower(d.submodel),'') = coalesce(lower(k.submodel),'')
  AND coalesce(d.engine_cc,-1) = coalesce(k.engine_cc,-1)
  AND d.fuel = k.fuel AND d.year_from = k.year_from
  AND coalesce(d.year_to,-1) = coalesce(k.year_to,-1)
  AND coalesce(d.transmission::text,'') = coalesce(k.transmission::text,'');

-- 2. redundant extended-model rows
DELETE FROM public.vehicle_models d USING public.vehicle_models b
WHERE d.id <> b.id AND lower(d.make) = lower(b.make)
  AND position(' ' in d.model) > 0
  AND lower(b.model) = lower(split_part(d.model, ' ', 1))
  AND d.fuel = b.fuel AND coalesce(d.engine_cc,-1) = coalesce(b.engine_cc,-1)
  AND (b.year_to IS NULL OR b.year_to >= d.year_from)
  AND (d.year_to IS NULL OR d.year_to >= b.year_from);

-- 3. timing corrections (applied per-row via service script; representative fix:)
UPDATE public.vehicle_models SET timing_drive = 'chain'
WHERE make = 'Volkswagen' AND model = 'Golf' AND submodel = 'R' AND timing_drive = 'belt';
UPDATE public.vehicle_models SET engine_code = 'CZCA 1.4 TSI'
WHERE make = 'Volkswagen' AND model = 'Golf' AND submodel = 'TSI' AND engine_code = 'CJZA 1.4 TSI';
