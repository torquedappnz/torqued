-- 013: booking notes (timestamped mechanic logs) + vehicle photos

create table if not exists booking_notes (
  id uuid default gen_random_uuid() primary key,
  booking_id text not null references bookings(id) on delete cascade,
  note text not null,
  author text not null default 'mechanic',
  created_at timestamptz not null default now()
);
create index if not exists booking_notes_booking_id_idx on booking_notes(booking_id);

create table if not exists vehicle_photos (
  id uuid default gen_random_uuid() primary key,
  rego text not null,
  booking_id text references bookings(id) on delete set null,
  photo_url text not null,
  comment text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_photos_rego_idx on vehicle_photos(rego);
