-- ============================================================
-- TORQUED — Migration 056: Mechanic parts/inventory database
-- Extends mechanic_parts with category/spec/unit/supplier/sell-price,
-- adds an in/out stock ledger (mechanic_inventory_transactions) for
-- stock reports, and a "Need to Order" queue (mechanic_reorder_queue)
-- populated when a confirmed booking needs parts the mechanic is low on.
-- ============================================================

-- ── 1. Extend mechanic_parts ─────────────────────────────────────────────────
ALTER TABLE public.mechanic_parts
  ADD COLUMN IF NOT EXISTS category_id integer REFERENCES public.part_categories(id),
  ADD COLUMN IF NOT EXISTS spec text,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'each',
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS sell_price_incl_gst numeric(10,2);

DO $$ BEGIN
  ALTER TABLE public.mechanic_parts ADD CONSTRAINT mechanic_parts_unit_check
    CHECK (unit IN ('each', 'litre', 'set', 'pair'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mechanic_parts_category_idx ON public.mechanic_parts(mechanic_id, category_id);

-- ── 2. Stock movement ledger ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mechanic_inventory_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  part_id      uuid NOT NULL REFERENCES public.mechanic_parts(id) ON DELETE CASCADE,
  direction    text NOT NULL CHECK (direction IN ('in', 'out')),
  quantity     integer NOT NULL CHECK (quantity > 0),
  reason       text NOT NULL DEFAULT 'manual_adjust' CHECK (reason IN ('restock', 'used_on_job', 'manual_adjust')),
  booking_id   text REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.mechanic_inventory_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Mechanics manage their own inventory transactions" ON public.mechanic_inventory_transactions
    FOR ALL USING (auth.uid() = mechanic_id) WITH CHECK (auth.uid() = mechanic_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mechanic_inventory_transactions_mechanic_date_idx
  ON public.mechanic_inventory_transactions(mechanic_id, created_at);
CREATE INDEX IF NOT EXISTS mechanic_inventory_transactions_part_idx
  ON public.mechanic_inventory_transactions(part_id);

-- ── 3. Need-to-order queue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mechanic_reorder_queue (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id               text REFERENCES public.bookings(id) ON DELETE SET NULL,
  category_id              integer REFERENCES public.part_categories(id),
  label                    text NOT NULL,
  quantity_needed          integer NOT NULL DEFAULT 1,
  possible_duplicate_part_id uuid REFERENCES public.mechanic_parts(id) ON DELETE SET NULL,
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'dismissed')),
  created_at               timestamptz DEFAULT now(),
  ordered_at               timestamptz
);

ALTER TABLE public.mechanic_reorder_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Mechanics manage their own reorder queue" ON public.mechanic_reorder_queue
    FOR ALL USING (auth.uid() = mechanic_id) WITH CHECK (auth.uid() = mechanic_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mechanic_reorder_queue_mechanic_status_idx
  ON public.mechanic_reorder_queue(mechanic_id, status);
-- Avoid re-queuing the same booking+category combo if the job is re-processed
CREATE UNIQUE INDEX IF NOT EXISTS mechanic_reorder_queue_booking_category_uq
  ON public.mechanic_reorder_queue(booking_id, category_id) WHERE booking_id IS NOT NULL AND category_id IS NOT NULL;
