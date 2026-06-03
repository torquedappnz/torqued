-- ============================================================
-- Torqued: Passkeys (WebAuthn credentials)
-- Run in Supabase SQL Editor after 004. Idempotent.
-- ============================================================

create table if not exists public.webauthn_credentials (
  id            uuid default gen_random_uuid() primary key,
  actor_type    text not null,                 -- 'customer' | 'mechanic' | 'admin'
  owner_ref     text not null,                 -- email (mechanic/admin) or rego (customer)
  credential_id text not null unique,          -- base64url credential id
  public_key    text not null,                 -- base64url COSE public key
  counter       bigint default 0,
  transports    text[],
  label         text,
  created_at    timestamptz default now()
);

create index if not exists idx_webauthn_owner on public.webauthn_credentials (actor_type, owner_ref);

alter table public.webauthn_credentials enable row level security;
-- service role only (server handles all ceremonies); no public policies
