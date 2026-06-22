-- Document REQUESTS (not uploads): admin asks a workshop to email in documents.
-- Documents arrive via the Torqued inbox; this table just tracks the ask + status.
CREATE TABLE IF NOT EXISTS mechanic_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  internal_comment text,
  requested_by text,
  requested_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS mechanic_document_requests_mechanic_idx
  ON mechanic_document_requests(mechanic_id);
