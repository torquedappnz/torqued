-- ============================================================
-- TORQUED — Migration 039: job_times_reference gaps
-- tier_parts_reference (037) has part costs for cabin_filter, 12v_battery,
-- and ignition_coil, but job_times_reference has no matching hours rows —
-- so the generic tier-fallback in /api/fleet-prices can price the part but
-- never the labour, and silently skips the whole job. Filling the gap.
-- Idempotent (ON CONFLICT DO NOTHING on UNIQUE(job_slug, tier)).
-- ============================================================

INSERT INTO public.job_times_reference (job_slug, tier, hours_low, hours_high, confidence, notes) VALUES
  ('cabin_filter','economy',0.3,0.5,3,'Glovebox/kick-panel filter swap'),
  ('cabin_filter','mid',0.3,0.5,3,NULL),
  ('cabin_filter','premium',0.4,0.6,3,NULL),
  ('cabin_filter','luxury',0.4,0.7,3,NULL),
  ('12v_battery','economy',0.3,0.5,3,'Swap + terminal clean'),
  ('12v_battery','premium',0.4,0.7,3,'May need battery registration/coding'),
  ('ignition_coil','economy',0.5,1.0,3,'Includes diagnostic time to isolate faulty coil'),
  ('ignition_coil','mid',0.6,1.2,3,NULL),
  ('ignition_coil','premium',0.8,1.5,3,NULL),
  ('ignition_coil','luxury',1.0,2.0,3,NULL)
ON CONFLICT (job_slug, tier) DO NOTHING;
