SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 063: alias backfill for unaliased fleet_vehicles
-- Every fleet_vehicles row now has at least one ef_vehicle_aliases row
-- (generated from its own make/model/submodel) so registry-name variants
-- resolve consistently through the alias path. Generic + idempotent.
-- Applied directly to production 2026-07-21 (data-only).
-- ============================================================

INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, fv.make, fv.model, fv.submodel, fv.year_from, fv.year_to, 'backfill_063'
FROM public.fleet_vehicles fv
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = fv.vehicle_id);
