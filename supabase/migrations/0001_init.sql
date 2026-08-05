-- Initial schema for the EMS duty roster.

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  role text not null default 'emt',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null
);

create table if not exists roster_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  shift_id uuid not null references shifts (id) on delete cascade,
  duty_date date not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  unique (staff_id, shift_id, duty_date)
);

alter table staff enable row level security;
alter table shifts enable row level security;
alter table roster_entries enable row level security;

create policy "Authenticated users can read staff" on staff
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can read shifts" on shifts
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can read roster_entries" on roster_entries
  for select using (auth.role() = 'authenticated');
