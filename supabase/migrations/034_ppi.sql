-- Pre-Purchase Inspections (PPI)
-- Mechanics opt in to offer PPIs ($199 flat, excludes HV battery testing).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS offers_ppi boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS ppi_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  booking_id uuid,
  rego text,
  make text,
  model text,
  submodel text,
  engine text,
  customer_name text,
  customer_email text,
  mileage integer,
  checklist jsonb,            -- [{ category, item, status, note }]
  inspector_comments text,
  recommendations text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ppi_mechanic ON ppi_inspections(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_ppi_rego ON ppi_inspections(rego);

-- Service-history access via a 12-hour LINK (replaces the one-time code flow).
CREATE TABLE IF NOT EXISTS history_access_links (
  token text PRIMARY KEY,
  mechanic_id uuid,
  rego text NOT NULL,
  owner_id uuid,
  granted boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_links_mech_rego ON history_access_links(mechanic_id, rego);
