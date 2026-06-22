-- Add mechanic reschedule request fields to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reschedule_requested_date timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_comment text,
  ADD COLUMN IF NOT EXISTS reschedule_status text CHECK (reschedule_status IN ('pending', 'accepted', 'declined'));
