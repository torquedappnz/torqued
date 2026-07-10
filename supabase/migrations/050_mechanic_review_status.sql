-- ============================================================
-- TORQUED — Migration 050: Mechanic admin-review gate
-- New mechanic signups now land in a "pending review" state after
-- signing the onboarding agreement, until an admin approves them.
-- Existing mechanics who already completed onboarding under the old
-- flow are grandfathered in as already-approved — this gate only
-- applies to new signups going forward.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS wants_wof boolean NOT NULL DEFAULT false;

UPDATE profiles SET review_status = 'approved' WHERE role = 'mechanic' AND onboarding_complete = true;
