ALTER TABLE vehicle_history
  ADD COLUMN IF NOT EXISTS source_type text CHECK (source_type IN ('torqued_job', 'ai_autoscan', 'customer_manual'))
  DEFAULT 'customer_manual';
