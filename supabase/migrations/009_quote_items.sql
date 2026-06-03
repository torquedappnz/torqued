-- ============================================================
-- Torqued: Structured quote line items (so the quote editor can be re-opened/edited)
-- + cold-quote customer fields. Run after 008. Idempotent.
-- ============================================================

-- Full structured breakdown: { parts:[{name,qty,unitPrice}], labourHours, labourRate, other:[{name,amount}], discount, notes }
alter table public.bookings add column if not exists quote_items jsonb;

-- Cold quoting: mechanic-originated bookings for customers with no prior Torqued relationship
alter table public.bookings add column if not exists is_cold_quote boolean default false;
alter table public.bookings add column if not exists customer_phone text;
