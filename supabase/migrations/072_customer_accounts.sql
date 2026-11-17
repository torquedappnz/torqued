-- 072: Workshop customer accounts (individual or business, bill-to, payment terms, credit limit)
--
-- A workshop can bill a business (an insurer, a fleet, a company) or anyone other
-- than the driver, for all of a job or part of it (e.g. $1,600 to the insurer and
-- the $400 excess from the driver). Each account belongs to one workshop. Quotes
-- and jobs link to an account via bookings.quote_items.meta.billTo, so no change
-- to bookings is needed.
--
-- customer_type: individual | business
--   business: legal_name, company (trading name), name (contact person), email,
--             phone, nzbn, bill_to_address
-- payment_terms:
--   cash          pay on or before collection (default)
--   month_20th    due in full on the 20th of the month after the invoice
--   custom_date   due in full on due_date
--   claim         paid through the insurer's / MBI provider's claims process
-- Only the server (service role) reads or writes this table.

create table if not exists public.customer_accounts (
  id                 uuid primary key default gen_random_uuid(),
  mechanic_id        uuid not null,
  customer_type      text not null default 'individual' check (customer_type in ('individual', 'business')),
  name               text not null,
  legal_name         text,
  company            text,
  nzbn               text,
  email              text,
  phone              text,
  bill_to_address    text,
  payment_terms      text not null default 'cash' check (payment_terms in ('cash', 'month_20th', 'custom_date', 'claim')),
  due_date           date,
  credit_limit       numeric(12,2) check (credit_limit is null or credit_limit >= 0),
  manual_terms       text,
  auto_email_invoice boolean not null default true,
  regos              text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists customer_accounts_mechanic_idx on public.customer_accounts (mechanic_id);
create index if not exists customer_accounts_email_idx on public.customer_accounts (mechanic_id, lower(email));

alter table public.customer_accounts enable row level security;
-- No policies: only the service role (server) may read or write.
