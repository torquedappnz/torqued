-- ============================================================
-- Torqued: Admin accounts (per-admin passwords)
-- Run in Supabase SQL Editor after 003. Idempotent.
-- ============================================================

create table if not exists public.admin_users (
  id            uuid default gen_random_uuid() primary key,
  email         text unique not null,
  password_hash text,                       -- "salt:hash" (pbkdf2-sha512); null until set
  created_at    timestamptz default now(),
  password_set_at timestamptz
);

alter table public.admin_users enable row level security;
-- No public policies: only the server (service role) reads/writes admin creds.

-- Seed the first admin (password not set yet — they'll create it via the setup link)
insert into public.admin_users (email) values ('sri.berry@icloud.com')
on conflict (email) do nothing;
