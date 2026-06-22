CREATE TABLE IF NOT EXISTS mechanic_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  description text,
  uploaded_at timestamptz DEFAULT now()
);
