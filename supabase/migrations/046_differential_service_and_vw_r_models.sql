-- ============================================================
-- TORQUED — Migration 046: Differential fluid service + VW "R" siblings
--   + Honda Jazz/Fit badge-engineering fix
--
-- ── Differential fluid service ──────────────────────────────────────────────
-- NOTE: this environment's Supabase credentials only support data operations
-- via the REST API (no DB password / exec_sql RPC available), so this could
-- not ship as a new DDL-created table this pass. The 62-vehicle differential
-- pricing dataset instead lives as a server-side constant
-- (DIFFERENTIAL_SERVICE_BY_VEHICLE in server.ts), keyed by fleet_vehicles.
-- vehicle_id — NOT by engine_family_id, because several engine families are
-- shared between a FWD variant (no diff) and an AWD/4WD sibling (e.g.
-- VW_EA888_20_TSI = Golf GTI FWD *and* Golf R AWD), and Toyota's E-Four hybrid
-- AWD (RAV4 Hybrid, Harrier Hybrid, Alphard Hybrid) shares its engine family
-- with genuine mechanical-AWD siblings despite having NO differential at all
-- (rear axle is driven by an electric motor). Keying by engine family would
-- either wrongly price a FWD car's diff or wrongly bill a hybrid E-Four car
-- for a service it can't have. If a proper migration path becomes available,
-- promote DIFFERENTIAL_SERVICE_BY_VEHICLE into a real
-- vehicle_differential_service(vehicle_id PK, tier, capacity_l,
-- fluid_cost_low/high, labour_hrs, shop_fee, notes) table with RLS public read.
--
-- Pricing: capacity_l x 75W-90 GL-4/5 gear oil (reuses existing
-- TRANS_MANUAL_GEAR fluid pricing, $16-30/L GST-incl) + 1.5hr default labour +
-- $25 shop fee. "rear only" = crossover/Haldex AWD single rear diff/PTU;
-- "front+rear" = genuine 4WD truck, both diffs. Recommend every 60,000km or
-- per manufacturer schedule, whichever comes first. Separate from
-- transmission service.
--
-- Documentation category (already applied directly via REST — included here
-- for the migration-history record; idempotent):
-- INSERT INTO part_categories (slug, display, job_group, is_job, notes) VALUES
--   ('differential_service', 'Differential fluid service', 'drivetrain', true,
--    'AWD/4WD only — priced per-vehicle, see DIFFERENTIAL_SERVICE_BY_VEHICLE in server.ts')
-- ON CONFLICT (slug) DO NOTHING;
-- ============================================================

-- ── VW "R" performance siblings ──────────────────────────────────────────────
-- Golf R already existed in fleet_vehicles (pricing worked) but was missing
-- from vehicle_models (the submodel picker UI) — that's why it never appeared
-- as a selectable variant. Tiguan R and T-Roc R were missing from both tables.

INSERT INTO fleet_vehicles (
    vehicle_id, make, model, submodel, chassis_code,
    year_from, year_to, engine_family_id, fuel, body_type, drivetrain, is_jdm_import, notes
) VALUES
  ('VW_TIGUAN_R_AD1_21_NOW', 'Volkswagen', 'Tiguan', 'R 2.0T', 'AD1', 2021, NULL, 'VW_EA888_20_TSI', 'petrol', 'suv', 'awd', false, 'Same EA888 R-tune as Golf R/S3, 4MOTION Haldex AWD'),
  ('VW_TROC_R_A1_19_NOW', 'Volkswagen', 'T-Roc', 'R 2.0T', 'A1', 2019, NULL, 'VW_EA888_20_TSI', 'petrol', 'suv', 'awd', false, 'Same EA888 R-tune as Golf R/S3, 4MOTION Haldex AWD')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source) VALUES
  ('VW_TIGUAN_R_AD1_21_NOW', 'Volkswagen', 'Tiguan R', '2.0T', 2021, NULL, 'manual'),
  ('VW_TROC_R_A1_19_NOW', 'Volkswagen', 'T-Roc R', '2.0T', 2019, NULL, 'manual');

INSERT INTO vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, is_jdm_import, timing_drive, notes) VALUES
  ('Volkswagen', 'Golf', 'R', 'MK7/8', 'CJXG 2.0 TSI', 2013, 2024, 'petrol', 1984, 'dsg', 'awd', 'hatch', false, 'belt', 'EA888 R-tune, 4MOTION Haldex AWD'),
  ('Volkswagen', 'Tiguan', 'R', 'AD1', 'CZPB 2.0 TSI', 2021, 2024, 'petrol', 1984, 'dsg', 'awd', 'suv', false, 'belt', 'EA888 R-tune, 4MOTION Haldex AWD'),
  ('Volkswagen', 'T-Roc', 'R', 'A1', 'DNUE 2.0 TSI', 2019, 2024, 'petrol', 1984, 'dsg', 'awd', 'suv', false, 'belt', 'EA888 R-tune, 4MOTION Haldex AWD')
ON CONFLICT (make, model, submodel, chassis_code, engine_code, year_from) DO NOTHING;

-- ── Honda Jazz = Honda Fit (badge-engineering, same pattern as Echo/Yaris, Auris/Corolla) ──
INSERT INTO ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source) VALUES
  ('HON_JAZZ_GE_08_14', 'Honda', 'Fit', '1.3/1.5', 2008, 2014, 'manual'),
  ('HON_JAZZ_GK_14_20', 'Honda', 'Fit', '1.5', 2014, 2020, 'manual'),
  ('HON_FIT_HYB_GP1_10_13', 'Honda', 'Jazz Hybrid', '1.3 IMA', 2010, 2013, 'manual'),
  ('HON_FIT_HYB_GP5_13_20', 'Honda', 'Jazz Hybrid', '1.5 i-DCD', 2013, 2020, 'manual');
