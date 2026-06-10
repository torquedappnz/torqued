-- Migration 021: Fix spark plug pricing in parts_data
--
-- The ignition_coils category was seeded with costs that combined coil packs + spark plugs
-- (part_cost_low ~$279, part_cost_high ~$527). The customer-facing service is "Spark Plugs"
-- (plugs only), not a full ignition system overhaul.
--
-- Corrected NZ retail prices for 4x spark plugs (all cylinders):
--   Low:  4x standard/aftermarket plugs  ~$80 NZD
--   High: 4x NGK/Bosch iridium OEM-spec  ~$200 NZD
--
-- Labour times corrected to plugs-only access (not coil removal on direct-injection engines):
--   Low:  0.5 hr  (easy access — most 4-cyl engines)
--   High: 1.0 hr  (tighter bays, e.g. transverse mounted)
--
-- Vehicles requiring 6+ plugs (inline-6, V6) are left for a future seed update.

UPDATE parts_data
SET
  part_cost_low  = 80,
  part_cost_high = 200
WHERE category_id = (
  SELECT id FROM part_categories WHERE slug = 'ignition_coils'
);

UPDATE labour_times
SET
  hours_low  = 0.5,
  hours_high = 1.0
WHERE category_id = (
  SELECT id FROM part_categories WHERE slug = 'ignition_coils'
);
