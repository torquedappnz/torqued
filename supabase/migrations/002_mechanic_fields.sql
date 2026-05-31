-- ============================================================
-- Torqued: Mechanic profile fields + parts inventory table
-- Run this in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

-- Extra columns on profiles for mechanic-specific data
alter table public.profiles
  add column if not exists nzbn              text,
  add column if not exists address           text,
  add column if not exists service_areas     text[]   default '{}',
  add column if not exists diagnostic_tools  text[]   default '{}',
  add column if not exists certifications    text[]   default '{}',
  add column if not exists labour_rate       numeric(10,2),
  add column if not exists shop_fee          numeric(10,2),
  add column if not exists banner_image      text;

-- Parts inventory owned by a mechanic
create table if not exists public.mechanic_parts (
  id              uuid    default gen_random_uuid() primary key,
  mechanic_id     uuid    references public.profiles(id) on delete cascade not null,
  name            text    not null,
  quantity        integer default 0,
  unit_price      numeric(10,2) default 0,
  description     text,
  min_stock_level integer,
  created_at      timestamptz default now()
);

alter table public.mechanic_parts enable row level security;

create policy "Mechanics manage their own parts"
  on public.mechanic_parts for all
  using (auth.uid() = mechanic_id)
  with check (auth.uid() = mechanic_id);
