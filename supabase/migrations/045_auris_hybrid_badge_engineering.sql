-- ============================================================
-- TORQUED — Migration 045: Auris Hybrid (badge-engineered Corolla Hybrid)
-- A 2016 "Auris" (no submodel/chassis stored) only matched the sole existing
-- Auris row — 1.8 PETROL, chassis ZRE15X, 2006-2012 — via the year-agnostic
-- fallback tier, since 2016 falls outside that range entirely. This silently
-- served the wrong (older, non-hybrid) engine's data, including a fabricated
-- transmission-fluid price for a car that has no conventional transmission —
-- the E180-generation Auris Hybrid shares its 1.8L 2ZR-FXE Atkinson hybrid
-- powertrain with the Corolla Hybrid (TOY_2ZRFXE_18_HYBRID — its own notes
-- literally list "Auris hybrid" as covered). Adding the correct year-banded
-- row lets it resolve directly via the exact-model+year tier, ahead of the
-- old petrol row (no year overlap: 2006-2012 vs 2013-2019).
--
-- General pattern to watch for: badge-engineered/rebadged models (Aqua ≈
-- Prius C is already correctly unified under TOY_1NZFXE_15_HYBRID) need
-- their own year-correct fleet_vehicles row, not just an alias, or a loose
-- fallback tier can match the wrong generation/powertrain.
-- Idempotent.
-- ============================================================

INSERT INTO fleet_vehicles (
    vehicle_id, make, model, submodel, chassis_code,
    year_from, year_to, engine_family_id, fuel, body_type, drivetrain, is_jdm_import, notes
) VALUES
  ('TOY_AURIS_HYB_ZWE186_13_19', 'Toyota', 'Auris', '1.8 Hybrid', 'ZWE186', 2013, 2019, 'TOY_2ZRFXE_18_HYBRID', 'hybrid_petrol', 'hatch', 'fwd', true, 'Same 2ZR-FXE hybrid powertrain as Corolla Hybrid ZWE211')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
VALUES ('TOY_AURIS_HYB_ZWE186_13_19', 'Toyota', 'Auris', '1.8 Hybrid', 2013, 2019, 'auto');
