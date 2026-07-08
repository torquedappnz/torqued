-- ============================================================
-- TORQUED — Migration 041: Toyota Avensis fleet coverage
-- The Avensis (a common NZ used import) had no fleet_vehicles / vehicle_models
-- entry, so /api/fleet-prices returned no prices for it. Add the T25 (2003-08)
-- and T27 (2009-18) petrol variants, mapped to the closest existing engine
-- families (which already carry fluids, service intervals and tier pricing):
--   1.8 (1ZZ-FE / 1ZR-FAE)  -> TOY_2ZRFE_18   (1.8 chain, same cost tier)
--   2.0 (1AZ-FSE / 3ZR-FAE) -> TOY_1AZFE_20   (2.0 chain)
--   2.4 (2AZ-FSE)           -> TOY_2AZFE_24   (2.4 chain)
-- Idempotent.
--
-- NOTE: the broader fix for *un-listed* vehicles is a code change — the
-- fleet-prices endpoint now always returns WOF / diagnostic / PPI for any
-- vehicle it can't match, so no customer hits a fully empty screen.
-- ============================================================

INSERT INTO fleet_vehicles (
    vehicle_id, make, model, submodel, chassis_code,
    year_from, year_to, engine_family_id, fuel, body_type, drivetrain, is_jdm_import, notes
) VALUES
  ('TOY_AVENSIS_AZT250_20_03_08', 'Toyota', 'Avensis', '2.0', 'AZT250', 2003, 2008, 'TOY_1AZFE_20', 'petrol', 'sedan', 'fwd', false, '1AZ-FSE D-4'),
  ('TOY_AVENSIS_AZT251_24_03_08', 'Toyota', 'Avensis', '2.4', 'AZT251', 2003, 2008, 'TOY_2AZFE_24', 'petrol', 'sedan', 'fwd', false, '2AZ-FSE'),
  ('TOY_AVENSIS_ZZT251_18_03_08', 'Toyota', 'Avensis', '1.8', 'ZZT251', 2003, 2008, 'TOY_2ZRFE_18', 'petrol', 'sedan', 'fwd', false, '1ZZ-FE — priced on 2ZR tier'),
  ('TOY_AVENSIS_ZRT272_20_09_18', 'Toyota', 'Avensis', '2.0', 'ZRT272', 2009, 2018, 'TOY_1AZFE_20', 'petrol', 'wagon', 'fwd', false, '3ZR-FAE Valvematic — priced on 1AZ tier'),
  ('TOY_AVENSIS_ZRT271_18_09_18', 'Toyota', 'Avensis', '1.8', 'ZRT271', 2009, 2018, 'TOY_2ZRFE_18', 'petrol', 'wagon', 'fwd', false, '1ZR-FAE Valvematic')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO ef_vehicle_aliases (
    vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source
) VALUES
  ('TOY_AVENSIS_AZT250_20_03_08', 'Toyota', 'Avensis', '2.0', 2003, 2008, 'auto'),
  ('TOY_AVENSIS_AZT251_24_03_08', 'Toyota', 'Avensis', '2.4', 2003, 2008, 'auto'),
  ('TOY_AVENSIS_ZZT251_18_03_08', 'Toyota', 'Avensis', '1.8', 2003, 2008, 'auto'),
  ('TOY_AVENSIS_ZRT272_20_09_18', 'Toyota', 'Avensis', '2.0', 2009, 2018, 'auto'),
  ('TOY_AVENSIS_ZRT271_18_09_18', 'Toyota', 'Avensis', '1.8', 2009, 2018, 'auto');
