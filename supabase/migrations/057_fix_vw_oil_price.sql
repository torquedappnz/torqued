-- ============================================================
-- TORQUED — Migration 057: fix VW 504.00/507.00 oil price ceiling
-- Was seeded at $22-40/L (migration 037); real NZ retail for this spec
-- (Castrol Edge Professional LL / equivalent) tops out closer to $30/L,
-- not $40/L — the $40 ceiling was overstating oil-change quotes.
-- ============================================================

UPDATE public.fluid_pricing
SET cost_per_litre_high = 30.00
WHERE fluid_id = 'OIL_5W30_VW504_507' AND cost_per_litre_high = 40.00;
