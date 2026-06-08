-- 012: Per-mechanic job cancellation policy
-- Hours of (open) notice required for a full refund; default 72h.
-- If cancelled with less notice, the customer is refunded this percentage; default 80%.
alter table profiles add column if not exists cancellation_notice_hours integer default 72;
alter table profiles add column if not exists cancellation_partial_refund_pct integer default 80;

-- Backfill any existing rows that were created before these columns existed.
update profiles set cancellation_notice_hours = 72 where cancellation_notice_hours is null;
update profiles set cancellation_partial_refund_pct = 80 where cancellation_partial_refund_pct is null;
