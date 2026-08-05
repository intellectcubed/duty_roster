-- Replace the generic staff/shifts/roster_entries model with the
-- coverage-segment model from docs/duty_roster_BUILD_SPEC.md: one row per
-- person covering a role for part (or all) of a shift. Splits are multiple
-- rows for the same date/shift/role; uncovered hours are never stored, they
-- are the render-time complement.

drop table if exists roster_entries;
drop table if exists shifts;
drop table if exists staff;

create table roster_segments (
  id uuid primary key default gen_random_uuid(),
  duty_date date not null,
  shift text not null check (shift in ('day', 'night')),
  role text not null check (role in ('crew_leader', 'driver', 'member_1', 'member_2')),
  member text not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3])[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3])[0-5][0-9]$'),
  created_at timestamptz not null default now()
);

create index roster_segments_duty_date_idx on roster_segments (duty_date);

alter table roster_segments enable row level security;

-- Public read: the site has no login flow. Writes are reserved for a
-- separate admin tool using the service_role/secret key.
create policy "Public can read roster_segments" on roster_segments
  for select using (true);
