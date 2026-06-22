-- Add ai_summary column to vehicle_history to cache AI-generated 5-word summaries
-- This avoids repeat API calls on every page load.
alter table public.vehicle_history
  add column if not exists ai_summary text;
