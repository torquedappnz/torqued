-- ============================================================
-- Torqued: 6-digit verification codes for the iOS app (serverless-safe, DB-backed)
-- Run in Supabase SQL Editor after 009. Idempotent.
-- ============================================================

create table if not exists public.customer_otps (
  rego        text primary key,
  code_hash   text not null,
  email       text,
  expires_at  timestamptz not null,
  attempts    integer default 0
);

alter table public.customer_otps enable row level security;
-- service role only (server issues + verifies); no public policies
