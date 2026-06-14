-- ============================================================
-- TORQUED — Migration 026: Updated resolve_part_price()
-- Now checks ef_parts_data first (via fleet_vehicles → engine_family_id),
-- then falls back to parts_data (vehicle_models keyed) for mechanic overrides.
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_part_price(
  p_mechanic_id uuid,
  p_vehicle_id  uuid,          -- vehicle_models.id (existing flow)
  p_category_id int
)
RETURNS TABLE (
  total_job_low   numeric,
  total_job_high  numeric,
  hours_low       numeric,
  hours_high      numeric,
  price_source    text,
  confidence      integer,
  is_verified     boolean
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_family_id text;
  v_string_id text;
BEGIN
  -- Try to get engine_family_id from fleet_vehicles (match by make/model/year)
  -- via the vehicle_models record for the given uuid
  SELECT fv.engine_family_id, fv.vehicle_id
    INTO v_family_id, v_string_id
    FROM vehicle_models vm
    JOIN fleet_vehicles fv
      ON fv.make = vm.make
     AND fv.model = vm.model
     AND fv.year_from <= vm.year_from
     AND (fv.year_to IS NULL OR fv.year_to >= COALESCE(vm.year_to, vm.year_from))
    WHERE vm.id = p_vehicle_id
    ORDER BY fv.year_from DESC
    LIMIT 1;

  -- Path 1: ef_parts_data found via engine family
  IF v_family_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      ep.total_job_low::numeric,
      ep.total_job_high::numeric,
      ep.hours_low,
      ep.hours_high,
      'ef_' || ep.engine_family_id     AS price_source,
      ep.confidence,
      false                            AS is_verified
    FROM ef_parts_data ep
    WHERE ep.engine_family_id = v_family_id
      AND ep.category_id = p_category_id;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Path 2: mechanic override on the old parts_data table
  RETURN QUERY
  SELECT
    COALESCE(o.part_cost, p.part_cost_low)::numeric   AS total_job_low,
    COALESCE(o.part_cost, p.part_cost_high)::numeric  AS total_job_high,
    COALESCE(o.labour_hours, l.hours_low)             AS hours_low,
    COALESCE(o.labour_hours, l.hours_high)            AS hours_high,
    CASE WHEN o.id IS NOT NULL THEN 'mechanic_inventory'
         ELSE p.source::text END                      AS price_source,
    p.confidence::integer,
    (o.id IS NOT NULL OR p.source = 'mechanic_verified') AS is_verified
  FROM parts_data p
  LEFT JOIN labour_times l
    ON l.vehicle_id = p.vehicle_id AND l.category_id = p.category_id
  LEFT JOIN mechanic_part_overrides o
    ON o.mechanic_id = p_mechanic_id
   AND o.vehicle_id  = p.vehicle_id
   AND o.category_id = p.category_id
  WHERE p.vehicle_id  = p_vehicle_id
    AND p.category_id = p_category_id;
END;
$$;
