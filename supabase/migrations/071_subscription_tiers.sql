SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 071: subscription tiers (subscription-only model)
-- Torqued drops the 4% commission and charges a monthly plan only:
--   starter $89 · pro $149 · max $249 per month + GST.
-- The tier is written on checkout/activation (Stripe metadata) and at
-- onboarding. NULL = a workshop that predates tiers: it keeps its current
-- access and promoted marketplace placement and is counted at Pro.
-- The app tolerates this column being absent, so this can run any time.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text
  CHECK (subscription_tier IS NULL OR subscription_tier IN ('starter', 'pro', 'max'));
