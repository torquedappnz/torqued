-- ============================================================
-- Torqued: Odometer tracking (system-wide per rego + per-job check-in/out)
-- Run in Supabase SQL Editor after 007. Idempotent.
-- ============================================================

-- Mechanic records the odometer when the car arrives and when it leaves
alter table public.bookings add column if not exists mileage_in  integer;
alter table public.bookings add column if not exists mileage_out integer;

-- vehicles.mileage already exists and is the system-wide source of truth per rego.
