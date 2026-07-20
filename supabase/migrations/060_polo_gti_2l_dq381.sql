-- ============================================================
-- TORQUED — Migration 060: add the Polo GTI (2.0 TSI, DQ381) — missing
-- entirely from both vehicle model tables. Every Polo in the database
-- pointed only at the 1.4 TSI (CGGB, DQ200 dry-clutch) engine, so any
-- Polo GTI rego lookup silently matched that wrong 1.4T/DQ200 variant
-- instead of the real 2.0T EA888 / DQ381 wet-clutch drivetrain.
-- ============================================================

-- Modern engine-family path (fleet_vehicles + alias) — reuses the existing
-- VW_EA888_20_TSI engine family already seeded with correct 2.0T data
-- (Golf GTI/R, Audi S3, etc.) and its DQ381-correct 7L trans_capacity_l.
INSERT INTO public.fleet_vehicles (
  vehicle_id, make, model, submodel, chassis_code,
  year_from, year_to, engine_family_id, fuel, body_type, drivetrain, notes
) VALUES (
  'VW_POLO_AW_GTI_18_NOW', 'Volkswagen', 'Polo', 'GTI 2.0T', 'AW',
  2018, NULL, 'VW_EA888_20_TSI', 'petrol', 'hatch', 'fwd',
  '2.0 TSI 147kW + DQ381 6-speed wet-clutch DSG — do not confuse with the base 1.0/1.4 TSI Polo (DQ200 dry-clutch)'
)
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_POLO_AW_GTI_18_NOW', 'Volkswagen', 'Polo', 'GTI', 2018, NULL, 'CZP', 'manual'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_POLO_AW_GTI_18_NOW' AND alias_variant = 'GTI'
);

-- Legacy vehicle_models fallback path — same correction so a vehicle that
-- doesn't resolve via fleet_vehicles still lands on the right variant.
INSERT INTO public.vehicle_models (
  make, model, submodel, chassis_code, engine_code,
  year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes
) VALUES (
  'Volkswagen', 'Polo', 'GTI 2.0T', 'AW', 'CZP',
  2018, NULL, 'petrol', 2000, 'dct', 'fwd', 'hatch', 'chain',
  '147kW EA888 2.0 TSI + DQ381 6-speed wet-clutch DSG'
)
ON CONFLICT (make, model, submodel, chassis_code, engine_code, year_from) DO NOTHING;
