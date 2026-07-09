-- ============================================================
-- TORQUED — Migration 047: 12V battery tier coverage gap
-- tier_parts_reference / job_times_reference only had 'economy' and 'premium'
-- rows for 12v_battery. Since the generic tier fallback tries the engine
-- family's own segment_tier first, then falls back to 'mid' — and 'mid' also
-- had no row — every 'mid' (45 families), 'luxury' (20), 'hybrid' (9) and
-- 'bev' (5) tier engine family got NO battery price at all (79 of 130
-- families, ~61% of the fleet), correctly showing as a quote but silently
-- missing data rather than a genuine gap in real-world pricing.
--
-- Reported as "battery (12V) pricing seems to be missing off database" while
-- testing a Golf GTI (which happens to be 'premium' tier and DID have a row,
-- confirmed realistic at $324-531 GST-incl against real NZ AGM stop-start
-- battery pricing — Repco/Supercheap/Superstart, $300-700+ installed for AGM).
-- The real gap was the missing mid/luxury/hybrid/bev tiers.
--
-- Applied directly to production (data-only, no DDL). Idempotent.
-- ============================================================

INSERT INTO tier_parts_reference (job_slug, tier, part_cost_low_ex_gst, part_cost_high_ex_gst, confidence, notes) VALUES
  ('12v_battery', 'mid', 150, 260, 3, 'EFB/AGM, mid-size'),
  ('12v_battery', 'luxury', 250, 450, 3, 'Large AGM, often needs registration/coding'),
  ('12v_battery', 'hybrid', 120, 200, 2, 'Small 12V accessory battery only — HV pack is separate; no starter cranking load'),
  ('12v_battery', 'bev', 100, 180, 2, 'Small 12V accessory battery only — no starter cranking load')
ON CONFLICT (job_slug, tier) DO NOTHING;

INSERT INTO job_times_reference (job_slug, tier, hours_low, hours_high, confidence, notes) VALUES
  ('12v_battery', 'mid', 0.3, 0.6, 3, 'Swap + terminal clean'),
  ('12v_battery', 'luxury', 0.5, 0.9, 3, 'May need battery registration/coding'),
  ('12v_battery', 'hybrid', 0.4, 0.7, 2, 'Often under seat/trunk floor — more access time'),
  ('12v_battery', 'bev', 0.4, 0.7, 2, 'Often under seat/trunk floor — more access time')
ON CONFLICT (job_slug, tier) DO NOTHING;
