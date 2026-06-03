-- ============================================================
-- Torqued: Vehicle service history (AI-imported + manual)
-- Run in Supabase SQL Editor after 005. Idempotent.
-- ============================================================

create table if not exists public.vehicle_history (
  id          uuid default gen_random_uuid() primary key,
  rego        text not null,
  owner_id    uuid references public.profiles(id) on delete set null,
  service_date text,                 -- free text date as parsed
  work_done   text,
  provider    text,
  mileage     integer,
  price       text,
  notes       text,
  source      text default 'import', -- 'import' | 'manual'
  created_at  timestamptz default now()
);

create index if not exists idx_vehicle_history_rego  on public.vehicle_history (rego);
create index if not exists idx_vehicle_history_owner on public.vehicle_history (owner_id);

alter table public.vehicle_history enable row level security;
-- service role handles writes; allow public read of a vehicle's history
drop policy if exists "read vehicle history" on public.vehicle_history;
create policy "read vehicle history" on public.vehicle_history for select using (true);
