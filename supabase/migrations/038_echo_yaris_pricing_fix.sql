-- ============================================================
-- TORQUED — Migration 038: Restore missing TOY_2NZFE_13 pricing rows
-- (Toyota Echo/Yaris 1.3, 1999-2005 — engine_family for CGA689 test vehicle)
--
-- brake_pads_front / brake_pads_rear were present in migration 024's source
-- but are absent from the live ef_parts_data table (drift between the
-- migration file and what was actually applied). comprehensive_service was
-- never seeded for this family at all, unlike its sibling TOY_1NZFE_15.
-- Idempotent — safe to re-run (ON CONFLICT DO NOTHING on the existing
-- UNIQUE(engine_family_id, category_id) constraint).
-- ============================================================

INSERT INTO ef_parts_data (
    engine_family_id, category_id,
    total_job_low, total_job_high, hours_low, hours_high,
    source_anchor, confidence, notes
)
SELECT v.* FROM (VALUES
  ('TOY_2NZFE_13', (SELECT id FROM part_categories WHERE slug = 'brake_pads_front'), 150, 230, 0.5, 0.8, 'brake_pads_economy', 3, 'Restored — present in migration 024 source but missing from live table'),
  ('TOY_2NZFE_13', (SELECT id FROM part_categories WHERE slug = 'brake_pads_rear'), 150, 230, 0.5, 0.8, 'brake_pads_economy', 3, 'Restored — present in migration 024 source but missing from live table'),
  ('TOY_2NZFE_13', (SELECT id FROM part_categories WHERE slug = 'comprehensive_service'), 240, 330, 1.0, 1.6, 'comprehensive_service_economy', 3, 'Never seeded — sibling TOY_1NZFE_15 has 280-380')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;
