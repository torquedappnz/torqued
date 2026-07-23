SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 068: draft_bookings (abandoned-booking recovery)
-- Captures a booking-in-progress once we know rego + email + selected
-- jobs + chosen mechanic. Deliberately a SEPARATE table from bookings so
-- drafts can never surface in any mechanic-facing query — a mechanic only
-- ever learns about the job if the customer completes payment (at which
-- point /api/bookings/persist marks the draft 'converted').
-- A 10-minute cron (/api/cron/abandoned-bookings) emails ONE nudge per
-- abandonment: drafts idle 10min-72h, status 'draft', no reminder sent yet.
-- Service-role access only — no public read/write.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.draft_bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rego             text NOT NULL,
  customer_email   text NOT NULL,
  customer_name    text,
  mechanic_id      text,
  mechanic_name    text,
  service_ids      jsonb NOT NULL DEFAULT '[]',
  service_labels   jsonb NOT NULL DEFAULT '[]',
  estimated_total  numeric(10,2),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','emailed','converted','dismissed')),
  reminder_sent_at timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (rego, customer_email)
);

CREATE INDEX IF NOT EXISTS idx_draft_bookings_pending
  ON public.draft_bookings (updated_at)
  WHERE status = 'draft' AND reminder_sent_at IS NULL;

ALTER TABLE public.draft_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "draft_bookings_service_all" ON public.draft_bookings;
CREATE POLICY "draft_bookings_service_all" ON public.draft_bookings
  USING (auth.role() = 'service_role');
