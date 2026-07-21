SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 065: fact-check corrections (web-verified)
-- Oil capacities:
--   EA211 1.4 TSI + GTE: 4.5 → 4.0L (Golf 7 1.4 TSI fill w/ filter = 4.0L)
--   EA888 1.8 TSI: 5.2 → 4.6L (A4 B8 1.8 TFSI oil change = 4.6L)
--   Toyota M20A-FKS/FXS: 4.5 → 4.6L (official fill w/ filter = 4.6L)
-- Wet DSG transmission SERVICE volumes (what a fluid change actually uses,
-- not total fill — total fill was previously stored, overquoting fluid):
--   DQ250 families (EA888 1.8 TSI, VR6): 7.0 → 5.5L (factory service 5.2-5.5L)
--   DQ381 families (EA888 2.0 TSI, EA288 2.0 TDI): 7.0 → 6.0L (kits ship 6L)
-- Verified correct, no change: PureTech wet belt 100,000km/6yr (matches the
-- revised Stellantis interval), K9K oil 4.4L + conservative 120k belt,
-- DQ200 2.0L + 1L gear oil, 1GD-FTV 7.5L, FIRE 2.8L.
-- Applied directly to production 2026-07-21 (data-only).
-- ============================================================

UPDATE public.engine_families SET oil_capacity_l = 4.0 WHERE family_id IN ('VW_EA211_14_TSI','VW_EA211_GTE_PHEV');
UPDATE public.engine_families SET oil_capacity_l = 4.6 WHERE family_id IN ('VW_EA888_18_TSI','TOY_M20AFKS_20','TOY_M20AFXS_20_HYBRID');

UPDATE public.service_schedule SET trans_capacity_l = 5.5,
  notes = COALESCE(notes || '; ', '') || 'service-exchange volume (not total fill)'
WHERE engine_family_id IN ('VW_EA888_18_TSI','VW_VR6_32_36') AND trans_capacity_l = 7.0;

UPDATE public.service_schedule SET trans_capacity_l = 6.0,
  notes = COALESCE(notes || '; ', '') || 'service-exchange volume (not total fill)'
WHERE engine_family_id IN ('VW_EA888_20_TSI','VW_EA288_20_TDI') AND trans_capacity_l = 7.0;
