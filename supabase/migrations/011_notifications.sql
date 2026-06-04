-- ============================================================
-- Torqued: in-app notifications feed (quote ready, reminders, mechanic messages)
-- Run in Supabase SQL Editor after 010. Idempotent.
-- ============================================================

create table if not exists public.notifications (
  id          uuid default gen_random_uuid() primary key,
  owner_id    uuid,
  rego        text,
  type        text not null,   -- quote_ready | service_reminder | review_reminder | dropoff_reminder | message
  title       text not null,
  body        text,
  booking_id  text,
  read        boolean default false,
  created_at  timestamptz default now()
);

create index if not exists idx_notifications_owner on public.notifications (owner_id, created_at desc);
create index if not exists idx_notifications_rego  on public.notifications (rego, created_at desc);

alter table public.notifications enable row level security;
-- service role handles all reads/writes (app fetches via a server endpoint)
