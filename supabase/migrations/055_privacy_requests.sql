-- Privacy Act 2020 request log (admin panel: AI/Privacy controls tab).
-- Access is service-role only via /api/admin/* endpoints (adminOk gate), same
-- pattern as mechanic_document_requests — no RLS needed.
CREATE TABLE IF NOT EXISTS privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete', 'correction', 'complaint')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_requests_email_idx ON privacy_requests(customer_email);
