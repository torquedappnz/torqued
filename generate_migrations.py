#!/usr/bin/env python3
"""
Generates migrations 022-025 for Torqued engine-family-first database.

Run: python3 generate_migrations.py
Outputs: supabase/migrations/022_*.sql through 025_*.sql
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from engine_families import ENGINE_FAMILIES, EngineFamily, JobAnchor
from engine_families_extensions import ADDITIONAL_FAMILIES
from vehicle_base import Vehicle
from vehicles_toyota import TOYOTA_VEHICLES
from vehicles_jdm import JDM_VEHICLES
from vehicles_euro_kor_other import OTHER_VEHICLES

ALL_FAMILIES = ENGINE_FAMILIES + ADDITIONAL_FAMILIES
ALL_VEHICLES = TOYOTA_VEHICLES + JDM_VEHICLES + OTHER_VEHICLES


def esc(s):
    """Escape a string for SQL single-quote context."""
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def num(v):
    if v is None:
        return 'NULL'
    return str(v)


def get_is_jdm(v: Vehicle) -> bool:
    """Handle the type ambiguity where some Vehicle() calls pass a string as is_jdm_import."""
    return bool(v.is_jdm_import) if isinstance(v.is_jdm_import, bool) else False


def get_notes(v: Vehicle):
    """Get notes, handling the case where a string was passed as is_jdm_import."""
    if isinstance(v.is_jdm_import, bool):
        return v.notes if v.notes else None
    else:
        # String was passed as is_jdm_import — treat as notes
        s = str(v.is_jdm_import)
        if v.notes:
            return s + ' / ' + v.notes
        return s


# ─── MIGRATION 022: engine_families table + new part_categories ───────────────

def gen_022():
    lines = []
    lines.append("""-- ============================================================
-- TORQUED — Migration 022: Engine Family Registry
-- Creates: engine_families table, adds missing part_category slugs
-- Numbering: follows 021 (existing migrations go 001–021)
-- ============================================================

-- ── 1. Add part category slugs needed by ef_parts_data ────────────────────────
-- (part_categories already seeded by 018; these add the missing job types)

INSERT INTO part_categories (slug, display, job_group, is_job, notes) VALUES
  ('basic_service',          'Basic service (oil + filter + check)', 'service',   true,  'standard oil-change service'),
  ('comprehensive_service',  'Comprehensive service',                'service',   true,  'all fluid checks, filters, inspection'),
  ('cambelt_full',           'Cambelt full replacement',             'engine',    true,  'belt + tensioner + idler + water pump'),
  ('wet_belt_replacement',   'Wet belt (IB oil-bath) replacement',   'engine',    true,  'Ford Ranger 3.2/2.2 wet belt; runs in oil'),
  ('hv_battery_refurb',      'HV battery – refurbished pack',        'ev_hybrid', true,  'refurbished/remanufactured high-voltage pack'),
  ('hv_battery_new_genuine', 'HV battery – new genuine',             'ev_hybrid', true,  'OEM new high-voltage pack'),
  ('hv_battery_used_24kwh',  'HV battery – used 24kWh pack',         'ev_hybrid', true,  'Leaf 24kWh like-for-like used'),
  ('hv_battery_upgrade_40kwh','HV battery – 40kWh upgrade',          'ev_hybrid', true,  'Leaf 40kWh capacity upgrade'),
  ('hv_battery_used',        'HV battery – used pack',               'ev_hybrid', true,  'generic used HV pack'),
  ('hv_battery_replacement', 'HV battery – replacement (speculative)','ev_hybrid',true,  'out-of-warranty, no market yet'),
  ('dq400e_oil_service',     'DQ400e wet-clutch DCT service',        'driveline', true,  'VW/Audi DQ400e G055540 ATF + filter'),
  ('rotor_rebuild',          'Rotary engine rebuild (apex seals)',    'engine',    true,  'RX-7/RX-8 specialist rebuild')
ON CONFLICT (slug) DO NOTHING;

-- ── 2. engine_families table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS engine_families (
    family_id                text PRIMARY KEY,
    common_name              text NOT NULL,
    manufacturer             text NOT NULL,
    displacement_l           numeric,
    cylinders                integer,
    fuel                     text NOT NULL,
    timing_type              text NOT NULL,  -- chain|belt|wet_belt|none
    cambelt_interval_km      integer,
    cambelt_interval_years   integer,
    oil_spec                 text,
    oil_capacity_l           numeric,
    coolant_spec             text,
    segment_tier             text,
    service_interval_km      integer DEFAULT 10000,
    service_interval_months  integer DEFAULT 12,
    notes                    text
);

-- RLS
ALTER TABLE engine_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engine_families_public_read" ON engine_families;
CREATE POLICY "engine_families_public_read" ON engine_families FOR SELECT USING (true);

-- ── 3. Seed engine_families ───────────────────────────────────────────────────

INSERT INTO engine_families (
    family_id, common_name, manufacturer, displacement_l, cylinders,
    fuel, timing_type, cambelt_interval_km, cambelt_interval_years,
    oil_spec, oil_capacity_l, coolant_spec, segment_tier,
    service_interval_km, service_interval_months, notes
) VALUES""")

    rows = []
    for f in ALL_FAMILIES:
        rows.append(
            f"  ({esc(f.family_id)}, {esc(f.common_name)}, {esc(f.manufacturer)}, "
            f"{num(f.displacement_l)}, {num(f.cylinders)}, "
            f"{esc(f.fuel)}, {esc(f.timing_type)}, {num(f.cambelt_interval_km)}, "
            f"{num(f.cambelt_interval_years)}, {esc(f.oil_spec)}, "
            f"{num(f.oil_capacity_l)}, {esc(f.coolant_spec)}, {esc(f.segment_tier)}, "
            f"{num(f.service_interval_km)}, {num(f.service_interval_months)}, {esc(f.notes) if f.notes else 'NULL'})"
        )
    lines.append(',\n'.join(rows))
    lines.append("ON CONFLICT (family_id) DO NOTHING;\n")
    lines.append(f"-- Family count: {len(ALL_FAMILIES)}")
    return '\n'.join(lines)


# ─── MIGRATION 023: fleet_vehicles table ──────────────────────────────────────

def gen_023():
    lines = []
    lines.append("""-- ============================================================
-- TORQUED — Migration 023: Fleet Vehicles (engine-family-keyed)
-- NOTE: Named fleet_vehicles (not vehicles) to avoid collision with
--   public.vehicles (customer-owned cars, migration 001) and
--   vehicle_models (prior fleet reference, migration 017).
-- ============================================================

CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id         text UNIQUE NOT NULL,  -- canonical string ID from Python
    make               text NOT NULL,
    model              text NOT NULL,
    submodel           text,
    chassis_code       text,
    year_from          integer NOT NULL,
    year_to            integer,
    engine_family_id   text REFERENCES engine_families(family_id),
    fuel               text NOT NULL,
    body_type          text NOT NULL,
    drivetrain         text NOT NULL,
    is_jdm_import      boolean DEFAULT false,
    notes              text,
    created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_make_model ON fleet_vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_family ON fleet_vehicles(engine_family_id);

-- RLS
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fleet_vehicles_public_read" ON fleet_vehicles;
CREATE POLICY "fleet_vehicles_public_read" ON fleet_vehicles FOR SELECT USING (true);

-- ── Seed fleet_vehicles ───────────────────────────────────────────────────────

INSERT INTO fleet_vehicles (
    vehicle_id, make, model, submodel, chassis_code,
    year_from, year_to, engine_family_id, fuel,
    body_type, drivetrain, is_jdm_import, notes
) VALUES""")

    rows = []
    for v in ALL_VEHICLES:
        is_jdm = get_is_jdm(v)
        notes = get_notes(v)
        rows.append(
            f"  ({esc(v.vehicle_id)}, {esc(v.make)}, {esc(v.model)}, "
            f"{esc(v.submodel)}, {esc(v.chassis_code)}, "
            f"{num(v.year_from)}, {num(v.year_to)}, {esc(v.engine_family_id)}, "
            f"{esc(v.fuel)}, {esc(v.body_type)}, {esc(v.drivetrain)}, "
            f"{'true' if is_jdm else 'false'}, {esc(notes)})"
        )
    lines.append(',\n'.join(rows))
    lines.append("ON CONFLICT (vehicle_id) DO NOTHING;\n")

    # count verification
    total = len(ALL_VEHICLES)
    jdm_count = sum(1 for v in ALL_VEHICLES if get_is_jdm(v))
    toyota_count = len(TOYOTA_VEHICLES)
    jdm_v_count = len(JDM_VEHICLES)
    other_count = len(OTHER_VEHICLES)
    lines.append(f"-- Vehicle counts: toyota={toyota_count} jdm={jdm_v_count} other={other_count} total={total}")
    lines.append(f"-- is_jdm_import=true: {jdm_count}")
    return '\n'.join(lines)


# ─── MIGRATION 024: ef_parts_data ─────────────────────────────────────────────

def gen_024():
    lines = []
    lines.append("""-- ============================================================
-- TORQUED — Migration 024: ef_parts_data (engine-family-keyed pricing)
-- Each row = one job's price range for one engine family.
-- category_id looked up by slug so serial IDs don't need to be hardcoded.
-- ============================================================

CREATE TABLE IF NOT EXISTS ef_parts_data (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_family_id   text NOT NULL REFERENCES engine_families(family_id),
    category_id        integer NOT NULL REFERENCES part_categories(id),
    total_job_low      integer NOT NULL,   -- NZD GST-inclusive
    total_job_high     integer NOT NULL,
    hours_low          numeric,
    hours_high         numeric,
    source_anchor      text,
    confidence         integer DEFAULT 2,
    notes              text,
    price_updated_at   timestamptz DEFAULT now(),
    UNIQUE(engine_family_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_ef_parts_family ON ef_parts_data(engine_family_id);
CREATE INDEX IF NOT EXISTS idx_ef_parts_category ON ef_parts_data(category_id);

-- RLS
ALTER TABLE ef_parts_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ef_parts_data_public_read" ON ef_parts_data;
CREATE POLICY "ef_parts_data_public_read" ON ef_parts_data FOR SELECT USING (true);

-- ── Seed ef_parts_data ────────────────────────────────────────────────────────
-- Uses subquery to resolve category slug → id, so no hardcoded serial IDs.

INSERT INTO ef_parts_data (
    engine_family_id, category_id,
    total_job_low, total_job_high, hours_low, hours_high,
    source_anchor, confidence, notes
)
SELECT v.* FROM (VALUES""")

    rows = []
    total_rows = 0
    for f in ALL_FAMILIES:
        for ja in f.job_anchors:
            rows.append(
                f"  ({esc(f.family_id)}, (SELECT id FROM part_categories WHERE slug = {esc(ja.job)}), "
                f"{ja.total_low}, {ja.total_high}, {ja.hours_low}, {ja.hours_high}, "
                f"{esc(ja.source_anchor)}, {ja.confidence}, {esc(ja.notes) if ja.notes else 'NULL'})"
            )
            total_rows += 1

    lines.append(',\n'.join(rows))
    lines.append(""") AS v(engine_family_id, category_id, total_job_low, total_job_high,
       hours_low, hours_high, source_anchor, confidence, notes)
WHERE v.category_id IS NOT NULL
ON CONFLICT (engine_family_id, category_id) DO NOTHING;\n""")
    lines.append(f"-- ef_parts_data rows: {total_rows}")
    return '\n'.join(lines)


# ─── MIGRATION 025: ef_vehicle_aliases ────────────────────────────────────────

def gen_025():
    lines = []
    lines.append("""-- ============================================================
-- TORQUED — Migration 025: EF Vehicle Aliases (fleet_vehicles keyed)
-- NOTE: Named ef_vehicle_aliases to avoid collision with vehicle_aliases
--   from migration 017 (which references vehicle_models by uuid).
-- For every fleet_vehicle: at least one alias (make+model).
-- For JDM imports with chassis_code: additional alias using chassis_code
--   in alias_variant to support Carjam chassis-code matching.
-- ============================================================

CREATE TABLE IF NOT EXISTS ef_vehicle_aliases (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id     text NOT NULL REFERENCES fleet_vehicles(vehicle_id),
    alias_make     text NOT NULL,
    alias_model    text NOT NULL,
    alias_variant  text,
    year_from      integer,
    year_to        integer,
    engine_code    text,
    source         text DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_ef_aliases_lookup
    ON ef_vehicle_aliases(alias_make, alias_model, year_from, year_to);

-- RLS
ALTER TABLE ef_vehicle_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ef_vehicle_aliases_public_read" ON ef_vehicle_aliases;
CREATE POLICY "ef_vehicle_aliases_public_read" ON ef_vehicle_aliases FOR SELECT USING (true);

-- ── Seed ef_vehicle_aliases ───────────────────────────────────────────────────

INSERT INTO ef_vehicle_aliases (
    vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source
) VALUES""")

    rows = []
    for v in ALL_VEHICLES:
        # Primary alias: make + model
        rows.append(
            f"  ({esc(v.vehicle_id)}, {esc(v.make)}, {esc(v.model)}, "
            f"{esc(v.submodel)}, {num(v.year_from)}, {num(v.year_to)}, 'auto')"
        )
        # JDM import with chassis_code: extra alias with chassis_code in alias_variant
        if get_is_jdm(v) and v.chassis_code:
            rows.append(
                f"  ({esc(v.vehicle_id)}, {esc(v.make)}, {esc(v.model)}, "
                f"{esc(v.chassis_code)}, {num(v.year_from)}, {num(v.year_to)}, 'chassis_code')"
            )

    lines.append(',\n'.join(rows))
    lines.append("ON CONFLICT DO NOTHING;\n")

    primary = len(ALL_VEHICLES)
    jdm_with_chassis = sum(
        1 for v in ALL_VEHICLES
        if get_is_jdm(v) and v.chassis_code
    )
    lines.append(f"-- alias count: {primary} primary + {jdm_with_chassis} chassis-code = {primary + jdm_with_chassis} total")
    return '\n'.join(lines)


# ─── MIGRATION 026: update resolve_part_price() ───────────────────────────────

def gen_026():
    return """-- ============================================================
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
"""


if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), 'supabase', 'migrations')

    migrations = [
        ('022_engine_families.sql', gen_022),
        ('023_fleet_vehicles.sql', gen_023),
        ('024_ef_parts_data.sql', gen_024),
        ('025_ef_vehicle_aliases.sql', gen_025),
        ('026_resolve_part_price_update.sql', gen_026),
    ]

    print(f"ALL_FAMILIES: {len(ALL_FAMILIES)}")
    print(f"  ENGINE_FAMILIES: {len(ENGINE_FAMILIES)}")
    print(f"  ADDITIONAL_FAMILIES: {len(ADDITIONAL_FAMILIES)}")
    print(f"ALL_VEHICLES: {len(ALL_VEHICLES)}")
    print(f"  TOYOTA_VEHICLES: {len(TOYOTA_VEHICLES)}")
    print(f"  JDM_VEHICLES: {len(JDM_VEHICLES)}")
    print(f"  OTHER_VEHICLES: {len(OTHER_VEHICLES)}")
    jdm_count = sum(1 for v in ALL_VEHICLES if get_is_jdm(v))
    print(f"  is_jdm_import=true: {jdm_count}")

    total_anchors = sum(len(f.job_anchors) for f in ALL_FAMILIES)
    print(f"Total job_anchors (ef_parts_data rows): {total_anchors}")

    primary_aliases = len(ALL_VEHICLES)
    extra_aliases = sum(1 for v in ALL_VEHICLES if get_is_jdm(v) and v.chassis_code)
    print(f"ef_vehicle_aliases: {primary_aliases} + {extra_aliases} = {primary_aliases + extra_aliases}")

    for filename, gen_fn in migrations:
        path = os.path.join(out_dir, filename)
        content = gen_fn()
        with open(path, 'w') as fh:
            fh.write(content)
        print(f"  wrote → {filename}")

    print("\nDone.")
