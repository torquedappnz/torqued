-- ============================================================
-- Torqued: Initial Schema
-- Run this in Supabase SQL Editor (dashboard.supabase.com)
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES (replaces Firebase consumers + mechanics collections)
-- ------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  name                 text,
  role                 text not null check (role in ('customer', 'mechanic')),
  phone                text,
  home_location        text,
  subscription_active  boolean default false,
  stripe_subscription_id text,
  created_at           timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Mechanics are publicly browsable (customers need to see them)
create policy "Mechanic profiles are publicly readable"
  on public.profiles for select
  using (role = 'mechanic');


-- ------------------------------------------------------------
-- VEHICLES (owned by customers; public rego lookup)
-- ------------------------------------------------------------
create table public.vehicles (
  id          uuid default gen_random_uuid() primary key,
  owner_id    uuid references public.profiles(id) on delete cascade,
  rego        text not null unique,
  make        text not null,
  model       text not null,
  year        integer not null,
  variant     text,
  mileage     integer default 0,
  thumbnail   text,
  created_at  timestamptz default now()
);

alter table public.vehicles enable row level security;

-- Anyone can check if a plate exists (needed for the rego lookup flow)
create policy "Public rego lookup"
  on public.vehicles for select
  using (true);

create policy "Owners can insert their vehicles"
  on public.vehicles for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their vehicles"
  on public.vehicles for update
  using (auth.uid() = owner_id);


-- ------------------------------------------------------------
-- BOOKINGS
-- ------------------------------------------------------------
create table public.bookings (
  id              text primary key,
  customer_id     uuid references public.profiles(id),
  mechanic_id     text not null,
  vehicle_rego    text references public.vehicles(rego),
  service_ids     text[] not null default '{}',
  status          text not null default 'pending',
  payment_status  text not null default 'pending',
  payment_method  text,
  date            text,
  total_price     numeric(10, 2) default 0,
  deposit_paid    numeric(10, 2),
  fault_code      text,
  description     text,
  stripe_session_id text,
  customer_name   text,
  email           text,
  phone           text,
  created_at      timestamptz default now()
);

alter table public.bookings enable row level security;

create policy "Customers can read their own bookings"
  on public.bookings for select
  using (auth.uid() = customer_id);

create policy "Customers can create bookings"
  on public.bookings for insert
  with check (auth.uid() = customer_id);

create policy "Customers can update their bookings"
  on public.bookings for update
  using (auth.uid() = customer_id);

create policy "Customers can delete their bookings"
  on public.bookings for delete
  using (auth.uid() = customer_id);

-- Mechanics can view bookings assigned to them (mechanic_id stores their auth uid)
create policy "Mechanics can read assigned bookings"
  on public.bookings for select
  using (mechanic_id = auth.uid()::text);

create policy "Mechanics can update assigned bookings"
  on public.bookings for update
  using (mechanic_id = auth.uid()::text);


-- ------------------------------------------------------------
-- AUTO-CREATE PROFILE ON FIRST SIGN-IN (trigger)
-- The app also handles this client-side, but this is a safety net.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
    coalesce(new.raw_user_meta_data->>'signup_role', 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
