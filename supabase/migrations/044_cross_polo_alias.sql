-- ============================================================
-- TORQUED — Migration 044: "Cross Polo" trim alias
-- Customer vehicles recorded with the "Cross Polo" trim name (a raised/rugged
-- variant of the 6R-generation Polo 1.4 TSI, same EA211 engine) didn't match
-- fleet_vehicles.model = 'Polo' under prefix matching, so the pricing endpoint
-- fell through to the fixed-services-only fallback (WOF/PPI/diagnostic) with
-- no price for anything else. Also wires up ef_vehicle_aliases as a fallback
-- lookup tier in server.ts (previously seeded but never queried) — this alias
-- fixes Cross Polo specifically, and the code change now lets any existing
-- chassis-code/trim alias resolve fleet-wide.
-- Idempotent.
-- ============================================================

INSERT INTO ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
VALUES ('VW_POLO_6R_14TSI_10_17', 'Volkswagen', 'Cross Polo', '1.4 TSI 6R', 2010, 2017, 'manual');
