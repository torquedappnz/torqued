-- Mechanic recurring availability slots (day-of-week based)
create table if not exists mechanic_availability (
  id uuid default gen_random_uuid() primary key,
  mechanic_id uuid not null references profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Mon, 6=Sun
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now()
);

create index if not exists mechanic_availability_mechanic_idx on mechanic_availability(mechanic_id);

-- Mechanic closed periods (specific date ranges — holidays, closures)
create table if not exists mechanic_closed_periods (
  id uuid default gen_random_uuid() primary key,
  mechanic_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz default now()
);

create index if not exists mechanic_closed_periods_mechanic_idx on mechanic_closed_periods(mechanic_id);
