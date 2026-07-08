-- ============================================================
-- TORQUED — Migration 040: VW TSI engine oil capacities
-- Corrects oil_capacity_l for the VW petrol TSI families so the oil/full
-- service bills the right litres. Values supplied by workshop (Torqued).
--
-- Sourcing note: published "with filter" capacity for the EA211 1.4 TSI is
-- commonly ~4.0L (oil-select.com, oil-change.info Golf VII). 4.5L is a
-- slightly generous workshop fill margin. The EA888 2.0 TSI ~5.8L matches
-- VW's official service fill. Prior DB values were 3.6L / 4.6L respectively.
-- Idempotent.
-- ============================================================

-- 1.4 TSI (EA211) — current Golf 7+ 1.4 TSI incl. the GTE/e-tron PHEV variant
UPDATE engine_families SET oil_capacity_l = 4.5
 WHERE family_id IN ('VW_EA211_14_TSI', 'VW_EA211_GTE_PHEV');

-- 2.0 TSI (EA888) — Golf GTI / R-line etc.
UPDATE engine_families SET oil_capacity_l = 5.8
 WHERE family_id = 'VW_EA888_20_TSI';
