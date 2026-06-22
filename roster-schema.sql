-- Torqued — Staff roster + calendar schema
-- Run this in the Supabase SQL editor once to enable the workshop roster + availability features.

-- Recurring weekly availability blocks (week-view calendar)
create table if not exists mechanic_availability (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null,
  day_of_week int  not null,           -- 0 = Monday … 6 = Sunday
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mechanic_availability_mechanic on mechanic_availability(mechanic_id);

-- Closed periods / public holidays (blocks customer bookings)
create table if not exists mechanic_closed_periods (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mechanic_closed_periods_mechanic on mechanic_closed_periods(mechanic_id);

-- Team members (technicians/staff a workshop can roster on)
create table if not exists mechanic_staff (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null,
  name        text not null,
  role        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mechanic_staff_mechanic on mechanic_staff(mechanic_id);

-- Rostered shifts (a staff member working a specific date, with optional scheduled break)
create table if not exists mechanic_roster (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null,
  staff_id    uuid not null references mechanic_staff(id) on delete cascade,
  shift_date  date not null,
  start_time  time not null,
  end_time    time not null,
  break_start time,
  break_end   time,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mechanic_roster_mechanic_date on mechanic_roster(mechanic_id, shift_date);

-- Customer revocations of mechanic data access.
-- A revocation hides a mechanic from the customer's "Mechanic Access" list UNLESS the customer
-- books / requests another quote with that mechanic after revoked_at (which re-grants access).
-- customer_ref is the owner_id (uuid as text) for logged-in customers, or 'rego:PLATE' otherwise.
create table if not exists mechanic_access_revocations (
  id           uuid primary key default gen_random_uuid(),
  customer_ref text not null,
  mechanic_id  uuid not null,
  revoked_at   timestamptz not null default now(),
  unique (customer_ref, mechanic_id)
);
create index if not exists idx_access_revocations_ref on mechanic_access_revocations(customer_ref);

-- Per-mechanic WoF (Warrant of Fitness) servicing flag.
-- Set true (via Admin portal) for workshops without a WoF Authority — they are then
-- excluded from Warrant of Fitness bookings on the customer side.
alter table if exists profiles add column if not exists wof_disabled boolean not null default false;

-- Refresh PostgREST schema cache so the new column/tables are visible immediately.
notify pgrst, 'reload schema';
