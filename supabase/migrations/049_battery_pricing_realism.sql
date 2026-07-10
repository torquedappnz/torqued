-- ============================================================
-- TORQUED — Migration 049: Raise 12V battery pricing (mid/premium/luxury)
-- Reported as "a bit hopeful" on a VW Tiguan R-Line (premium tier) — confirmed
-- with the user: the whole range felt underpriced, not just the low end.
-- Raised ex-GST bounds for mid/premium/luxury (modern stop-start cars
-- realistically need AGM/EFB, not a basic flooded battery). Economy tier
-- unchanged — older/simpler cars still realistically use basic batteries.
--
--   mid:     $150-260 -> $200-350 ex-GST
--   premium: $200-380 -> $260-500 ex-GST
--   luxury:  $250-450 -> $320-600 ex-GST
--
-- Verified live: Tiguan R-Line (premium) battery job total $333-540 -> $402-678.
-- Applied directly to production (data-only). Idempotent (plain UPDATE).
-- ============================================================

UPDATE tier_parts_reference SET part_cost_low_ex_gst = 200, part_cost_high_ex_gst = 350, notes = 'EFB/AGM stop-start, mid-size'
 WHERE job_slug = '12v_battery' AND tier = 'mid';
UPDATE tier_parts_reference SET part_cost_low_ex_gst = 260, part_cost_high_ex_gst = 500, notes = 'AGM stop-start (VW/Audi typical)'
 WHERE job_slug = '12v_battery' AND tier = 'premium';
UPDATE tier_parts_reference SET part_cost_low_ex_gst = 320, part_cost_high_ex_gst = 600, notes = 'Large AGM, often needs registration/coding'
 WHERE job_slug = '12v_battery' AND tier = 'luxury';
