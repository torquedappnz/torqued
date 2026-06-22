CREATE TABLE IF NOT EXISTS mechanic_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workshop_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workshop_email_verified boolean DEFAULT false;
