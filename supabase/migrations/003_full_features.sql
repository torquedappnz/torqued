-- ============================================================
-- Torqued: Full feature schema (run once in Supabase SQL Editor)
-- Safe to re-run (idempotent via IF NOT EXISTS / on conflict).
-- ============================================================

-- ── Mechanic profile fields (onboarding, payout, capacity) ──
alter table public.profiles
  add column if not exists nzbn                 text,
  add column if not exists address              text,
  add column if not exists owner_name           text,
  add column if not exists bank_account_name    text,
  add column if not exists bank_account_number  text,
  add column if not exists service_areas        text[]  default '{}',
  add column if not exists diagnostic_tools     text[]  default '{}',
  add column if not exists certifications        text[]  default '{}',
  add column if not exists labour_rate          numeric(10,2),
  add column if not exists shop_fee             numeric(10,2),
  add column if not exists banner_image         text,
  add column if not exists technicians          integer default 1,
  add column if not exists parts_lead_days      integer default 1,
  add column if not exists onboarding_complete  boolean default false,
  add column if not exists rating               numeric(3,2) default 0,
  add column if not exists review_count         integer default 0;

-- ── Parts inventory ─────────────────────────────────────────
create table if not exists public.mechanic_parts (
  id              uuid default gen_random_uuid() primary key,
  mechanic_id     uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  quantity        integer default 0,
  unit_price      numeric(10,2) default 0,
  description     text,
  min_stock_level integer,
  created_at      timestamptz default now()
);
alter table public.mechanic_parts enable row level security;
do $$ begin
  create policy "Mechanics manage their own parts" on public.mechanic_parts
    for all using (auth.uid() = mechanic_id) with check (auth.uid() = mechanic_id);
exception when duplicate_object then null; end $$;

-- ── Verified reviews ────────────────────────────────────────
create table if not exists public.reviews (
  id              uuid default gen_random_uuid() primary key,
  booking_id      text,
  mechanic_id     uuid references public.profiles(id) on delete cascade,
  customer_email  text,
  customer_name   text,
  rating          integer not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz default now()
);
alter table public.reviews enable row level security;
do $$ begin
  create policy "Reviews are publicly readable" on public.reviews for select using (true);
exception when duplicate_object then null; end $$;

-- ── Mechanic service packages (optional, per workshop) ──────
create table if not exists public.service_packages (
  id           uuid default gen_random_uuid() primary key,
  mechanic_id  uuid references public.profiles(id) on delete cascade not null,
  name         text not null,
  description  text,
  price        numeric(10,2) not null,
  duration_min integer default 60,
  created_at   timestamptz default now()
);
alter table public.service_packages enable row level security;
do $$ begin
  create policy "Packages publicly readable" on public.service_packages for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Mechanics manage own packages" on public.service_packages
    for all using (auth.uid() = mechanic_id) with check (auth.uid() = mechanic_id);
exception when duplicate_object then null; end $$;

-- ── Bookings: quote editing + refunds + review tracking ─────
alter table public.bookings
  add column if not exists quoted_price      numeric(10,2),
  add column if not exists quote_note         text,
  add column if not exists refunded_amount    numeric(10,2) default 0,
  add column if not exists stripe_payment_intent text,
  add column if not exists completed_at       timestamptz,
  add column if not exists review_requested   boolean default false;

-- ── Admin: simple revenue/event ledger (commission + subs) ──
create table if not exists public.platform_events (
  id          uuid default gen_random_uuid() primary key,
  type        text not null,            -- 'commission' | 'subscription' | 'refund'
  amount      numeric(10,2) not null,
  mechanic_id uuid,
  booking_id  text,
  note        text,
  created_at  timestamptz default now()
);
alter table public.platform_events enable row level security;
-- service role only (no public policy) — admin reads via server endpoints
