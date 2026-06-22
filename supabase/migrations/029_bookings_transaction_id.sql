ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transaction_id text;
CREATE INDEX IF NOT EXISTS idx_bookings_transaction_id ON bookings(transaction_id);
