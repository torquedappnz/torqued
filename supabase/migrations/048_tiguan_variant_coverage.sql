-- ============================================================
-- TORQUED — Migration 048: VW Tiguan AD1 variant coverage
--
-- Two compounding bugs surfaced together:
-- 1. A 2021 Tiguan lookup had exactly ONE vehicle_models candidate (the
--    "Tiguan R" performance AWD entry added last session), so it was
--    auto-selected and silently mislabelled a 2WD R-Line customer's car as
--    the AWD performance R — wrong engine tune assumption, wrong drivetrain,
--    and no differential-fluid-service false positive risk avoided by luck
--    only (this car happened to still resolve engine family correctly).
-- 2. The one existing fleet_vehicles row for this generation had
--    submodel='1.4/2.0 TSI' mapped ENTIRELY to the 1.4L-only engine family
--    (VW_EA211_14_TSI) and drivetrain='awd' — meaning any 2.0 TSI Tiguan got
--    the wrong (smaller) engine's oil capacity/spec/tier, and any FWD Tiguan
--    got treated as AWD.
--
-- Real spec (verified): FWD Tiguan = 6-speed DSG; 4MOTION (AWD) = 7-speed
-- wet DSG (DQ500). NZ R-Line trim is commonly FWD even with the 2.0 TSI engine.
--
-- Fix: corrected the existing 1.4 TSI row (submodel + drivetrain), and added
-- distinct entries for 2.0 TSI R-Line (FWD) and 2.0 TSI 4MOTION (AWD), both
-- correctly mapped to VW_EA888_20_TSI — plus a 1.4 TSI manual variant in
-- vehicle_models for picker completeness. A 2021 lookup now returns 5 real
-- candidates instead of silently auto-selecting the wrong one.
--
-- Also fixes the "change variant" button doing nothing after a single-match
-- auto-select (separate CustomerPortal.tsx code fix, same commit): the
-- picker's candidate list was only ever populated when there were 2+ matches,
-- so re-opening it after an auto-selected single match had nothing to show.
--
-- Applied directly to production (data-only, no DDL). Idempotent inserts;
-- the 1.4 TSI row fix is an UPDATE (re-running is a no-op past the first time).
-- ============================================================

UPDATE fleet_vehicles SET submodel = '1.4 TSI', drivetrain = 'fwd', notes = '6-speed DSG (FWD Tiguan spec)'
 WHERE vehicle_id = 'VW_TIGUAN_AD1_14TSI_16_NOW';
UPDATE ef_vehicle_aliases SET alias_variant = '1.4 TSI'
 WHERE vehicle_id = 'VW_TIGUAN_AD1_14TSI_16_NOW';

INSERT INTO fleet_vehicles (vehicle_id, make, model, submodel, chassis_code, year_from, year_to, engine_family_id, fuel, body_type, drivetrain, is_jdm_import, notes) VALUES
  ('VW_TIGUAN_AD1_20TSI_FWD_16_NOW', 'Volkswagen', 'Tiguan', 'R-Line', 'AD1', 2016, NULL, 'VW_EA888_20_TSI', 'petrol', 'suv', 'fwd', false, '2.0 TSI R-Line NZ-spec, 6-speed DSG (FWD)'),
  ('VW_TIGUAN_AD1_20TSI_AWD_16_NOW', 'Volkswagen', 'Tiguan', '4MOTION', 'AD1', 2016, NULL, 'VW_EA888_20_TSI', 'petrol', 'suv', 'awd', false, '2.0 TSI Highline 4MOTION, 7-speed DSG (AWD)')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source) VALUES
  ('VW_TIGUAN_AD1_20TSI_FWD_16_NOW', 'Volkswagen', 'Tiguan', 'R-Line', 2016, NULL, 'manual'),
  ('VW_TIGUAN_AD1_20TSI_AWD_16_NOW', 'Volkswagen', 'Tiguan', '4MOTION', 2016, NULL, 'manual');

INSERT INTO vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, is_jdm_import, timing_drive, notes) VALUES
  ('Volkswagen', 'Tiguan', '1.4 TSI', 'AD1', 'CJZA 1.4 TSI', 2016, 2024, 'petrol', 1395, 'dsg', 'fwd', 'suv', false, 'belt', '6-speed DSG (FWD)'),
  ('Volkswagen', 'Tiguan', '1.4 TSI Manual', 'AD1', 'CJZA 1.4 TSI', 2016, 2024, 'petrol', 1395, 'manual', 'fwd', 'suv', false, 'belt', '6-speed manual (FWD, less common NZ-new)'),
  ('Volkswagen', 'Tiguan', 'R-Line', 'AD1', 'CZPB 2.0 TSI', 2016, 2024, 'petrol', 1984, 'dsg', 'fwd', 'suv', false, 'chain', '6-speed DSG (FWD NZ-spec R-Line)'),
  ('Volkswagen', 'Tiguan', '4MOTION', 'AD1', 'CZPB 2.0 TSI', 2016, 2024, 'petrol', 1984, 'dsg', 'awd', 'suv', false, 'chain', '7-speed wet DSG (4MOTION AWD)')
ON CONFLICT (make, model, submodel, chassis_code, engine_code, year_from) DO NOTHING;
