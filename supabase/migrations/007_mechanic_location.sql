-- ============================================================
-- Torqued: Mechanic geolocation (for distance-based search)
-- Run in Supabase SQL Editor after 006. Idempotent.
-- ============================================================

alter table public.profiles add column if not exists latitude  double precision;
alter table public.profiles add column if not exists longitude double precision;

-- Backfill the one live workshop (Precision Mechanical, South Dunedin) so
-- distance search works immediately. Geocoding refines this on next onboard.
update public.profiles
set latitude = -45.8920, longitude = 170.5110
where role = 'mechanic' and latitude is null;
