-- ============================================================
-- TORQUED — Migration 017: NZ Vehicle Fleet Central Database
-- Covers: vehicle_models, parts pricing, labour times, fluids,
-- service intervals, HV batteries, 12V battery specs,
-- mechanic override layer, and price resolution.
--
-- NOTE: Table is named "vehicle_models" (not "vehicles") because
-- migration 001 already created public.vehicles for customer-owned
-- cars. This table is the canonical fleet reference database.
--
-- Idempotent: safe to run on a database where 001–016 already ran.
-- ============================================================

-- ---------- ENUMS ----------

DO $$ BEGIN
  CREATE TYPE fuel_type AS ENUM ('petrol','diesel','hybrid','phev','bev');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE drive_type AS ENUM ('fwd','rwd','awd','4wd');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transmission_type AS ENUM ('manual','auto','cvt','dct','single_speed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE data_source AS ENUM (
    'ai_seed',
    'supplier_feed',
    'mechanic_verified',
    'oem_published'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fluid_kind AS ENUM (
    'engine_oil','brake_fluid','coolant','transmission_fluid',
    'power_steering_fluid','aircon_refrigerant','diff_oil','transfer_case_oil'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE service_item AS ENUM (
    'engine_oil','brake_fluid','coolant','transmission_fluid',
    'timing_belt','timing_chain','spark_plugs','cabin_filter','air_filter'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------- 1. VEHICLE MODELS (fleet reference) ----------

CREATE TABLE IF NOT EXISTS vehicle_models (
  id              uuid primary key default gen_random_uuid(),
  make            text not null,
  model           text not null,
  submodel        text,
  chassis_code    text,
  engine_code     text,
  year_from       smallint not null,
  year_to         smallint,
  fuel            fuel_type not null,
  engine_cc       integer,
  transmission    transmission_type,
  drive           drive_type,
  body_type       text,
  is_jdm_import   boolean default false,
  timing_drive    text check (timing_drive in ('belt','chain','gear','na')),
  notes           text,
  created_at      timestamptz default now(),
  unique (make, model, submodel, chassis_code, engine_code, year_from)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_make_model ON vehicle_models (make, model);

-- Carjam alias mapping: plate-lookup make/model/year → vehicle_models.id
CREATE TABLE IF NOT EXISTS vehicle_aliases (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicle_models(id) on delete cascade,
  alias_make    text not null,
  alias_model   text not null,
  alias_variant text,
  year_from     smallint,
  year_to       smallint,
  engine_code   text,
  unique (alias_make, alias_model, alias_variant, year_from, engine_code)
);

CREATE INDEX IF NOT EXISTS idx_aliases_lookup ON vehicle_aliases (alias_make, alias_model);

-- ---------- 2. PART / JOB CATEGORIES ----------

CREATE TABLE IF NOT EXISTS part_categories (
  id          serial primary key,
  slug        text unique not null,
  display     text not null,
  job_group   text not null,
  is_job      boolean default true,
  notes       text
);

-- ---------- 3. CENTRAL PARTS PRICING ----------

CREATE TABLE IF NOT EXISTS parts_data (
  id               uuid primary key default gen_random_uuid(),
  vehicle_id       uuid not null references vehicle_models(id) on delete cascade,
  category_id      int  not null references part_categories(id),
  part_cost_low    numeric(10,2),
  part_cost_high   numeric(10,2),
  oem_part_number  text,
  preferred_supplier text,
  source           data_source not null default 'ai_seed',
  confidence       smallint check (confidence between 1 and 5) default 2,
  price_updated_at timestamptz default now(),
  last_verified_at timestamptz,
  notes            text,
  unique (vehicle_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_parts_vehicle ON parts_data (vehicle_id);

-- ---------- 4. MECHANIC OVERRIDE LAYER ----------

CREATE TABLE IF NOT EXISTS mechanic_part_overrides (
  id            uuid primary key default gen_random_uuid(),
  mechanic_id   uuid not null,
  vehicle_id    uuid not null references vehicle_models(id) on delete cascade,
  category_id   int  not null references part_categories(id),
  part_cost     numeric(10,2) not null,
  part_number   text,
  supplier      text,
  in_stock      boolean default false,
  labour_hours  numeric(4,1),
  updated_at    timestamptz default now(),
  unique (mechanic_id, vehicle_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_overrides_mech ON mechanic_part_overrides (mechanic_id, vehicle_id);

-- ---------- 5. LABOUR TIMES ----------

CREATE TABLE IF NOT EXISTS labour_times (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references vehicle_models(id) on delete cascade,
  category_id  int  not null references part_categories(id),
  hours_low    numeric(4,1) not null,
  hours_high   numeric(4,1) not null,
  source       data_source not null default 'ai_seed',
  confidence   smallint check (confidence between 1 and 5) default 2,
  notes        text,
  unique (vehicle_id, category_id)
);

-- ---------- 6. FLUIDS & CAPACITIES ----------

CREATE TABLE IF NOT EXISTS vehicle_fluids (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicle_models(id) on delete cascade,
  fluid         fluid_kind not null,
  specification text not null,
  capacity      numeric(6,2),
  unit          text default 'L' check (unit in ('L','g','mL')),
  source        data_source not null default 'oem_published',
  notes         text,
  unique (vehicle_id, fluid)
);

-- ---------- 7. SERVICE INTERVALS ----------

CREATE TABLE IF NOT EXISTS service_intervals (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicle_models(id) on delete cascade,
  item          service_item not null,
  interval_km   integer,
  interval_months integer,
  source        data_source not null default 'oem_published',
  notes         text,
  unique (vehicle_id, item)
);

-- ---------- 8. HIGH-VOLTAGE BATTERIES (hybrid/EV) ----------

CREATE TABLE IF NOT EXISTS hv_batteries (
  id                 uuid primary key default gen_random_uuid(),
  vehicle_id         uuid not null references vehicle_models(id) on delete cascade,
  chemistry          text,
  capacity_kwh       numeric(6,2),
  new_cost_low       numeric(10,2),
  new_cost_high      numeric(10,2),
  refurb_cost_low    numeric(10,2),
  refurb_cost_high   numeric(10,2),
  source             data_source not null default 'ai_seed',
  confidence         smallint check (confidence between 1 and 5) default 2,
  notes              text,
  unique (vehicle_id)
);

-- ---------- 9. 12V BATTERY FACTORY SPECS ----------

CREATE TABLE IF NOT EXISTS battery_12v_specs (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references vehicle_models(id) on delete cascade,
  size_code   text not null,
  cca         integer,
  ah          integer,
  technology  text default 'standard' check (technology in ('standard','EFB','AGM','lithium_aux')),
  notes       text,
  source      data_source not null default 'oem_published',
  unique (vehicle_id)
);

-- ---------- 10. MONTHLY PRICE REFRESH LOG ----------

CREATE TABLE IF NOT EXISTS price_update_runs (
  id            uuid primary key default gen_random_uuid(),
  run_date      date not null default current_date,
  supplier      text,
  rows_updated  integer,
  method        text,
  notes         text
);

-- ---------- 11. PRICE RESOLUTION ----------

CREATE OR REPLACE FUNCTION resolve_part_price(
  p_mechanic_id uuid,
  p_vehicle_id  uuid,
  p_category_id int
)
RETURNS TABLE (
  part_cost_low  numeric,
  part_cost_high numeric,
  labour_low     numeric,
  labour_high    numeric,
  price_source   text,
  is_verified    boolean
)
LANGUAGE sql STABLE AS $$
  SELECT
    coalesce(o.part_cost, p.part_cost_low)            AS part_cost_low,
    coalesce(o.part_cost, p.part_cost_high)           AS part_cost_high,
    coalesce(o.labour_hours, l.hours_low)             AS labour_low,
    coalesce(o.labour_hours, l.hours_high)            AS labour_high,
    CASE WHEN o.id IS NOT NULL THEN 'mechanic_inventory'
         ELSE p.source::text END                      AS price_source,
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
$$;

-- ---------- 12. RLS ----------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vehicle_models' AND relrowsecurity = true) THEN
    ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vehicle_aliases' AND relrowsecurity = true) THEN
    ALTER TABLE vehicle_aliases ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'part_categories' AND relrowsecurity = true) THEN
    ALTER TABLE part_categories ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'parts_data' AND relrowsecurity = true) THEN
    ALTER TABLE parts_data ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'labour_times' AND relrowsecurity = true) THEN
    ALTER TABLE labour_times ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vehicle_fluids' AND relrowsecurity = true) THEN
    ALTER TABLE vehicle_fluids ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_intervals' AND relrowsecurity = true) THEN
    ALTER TABLE service_intervals ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hv_batteries' AND relrowsecurity = true) THEN
    ALTER TABLE hv_batteries ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'battery_12v_specs' AND relrowsecurity = true) THEN
    ALTER TABLE battery_12v_specs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mechanic_part_overrides' AND relrowsecurity = true) THEN
    ALTER TABLE mechanic_part_overrides ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'price_update_runs' AND relrowsecurity = true) THEN
    ALTER TABLE price_update_runs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Central reference data: readable by everyone (anon included, for the
-- customer plate-lookup flow), writable only by service role.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vehicle_models','vehicle_aliases','part_categories','parts_data',
    'labour_times','vehicle_fluids','service_intervals',
    'hv_batteries','battery_12v_specs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_public_read" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_public_read" ON %I FOR SELECT USING (true)', t, t);
  END LOOP;
END $$;

-- Mechanic overrides: each workshop sees and edits only its own rows.
DROP POLICY IF EXISTS "override_owner_all" ON mechanic_part_overrides;
CREATE POLICY "override_owner_all" ON mechanic_part_overrides
  FOR ALL USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);
