-- Admin tool schema: registered members (replacing free-text names),
-- a roles lookup, and an audit trail of roster changes.
-- See docs/duty_roster_administration.md.

-- ---------------------------------------------------------------------
-- roles: lookup for a member's qualification (distinct from the fixed
-- crew_leader/driver/member_1/member_2 slot keys already in
-- roster_segments.role).
-- ---------------------------------------------------------------------
create table roles (
  key text primary key,
  label text not null
);

insert into roles (key, label) values
  ('crew_chief', 'EMT/Crew Chief'),
  ('emt', 'EMT'),
  ('driver', 'Driver'),
  ('assistant', 'Assistant'),
  ('cadet', 'Cadet');

alter table roles enable row level security;
create policy "Public can read roles" on roles for select using (true);

-- ---------------------------------------------------------------------
-- members: registered crew, linked to their Supabase Auth account once
-- they've logged in at least once (auth_user_id is nullable until then).
-- ---------------------------------------------------------------------
create table members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  role_key text not null references roles (key),
  phone_number text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table members enable row level security;

-- Full table (incl. phone_number) requires login.
create policy "Authenticated can read members" on members
  for select using (auth.role() = 'authenticated');
create policy "Authenticated can insert members" on members
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update members" on members
  for update using (auth.role() = 'authenticated');

-- Public-safe view for the read-only display site: name only, no phone
-- number or auth linkage. Owned by the migration role, so it sees through
-- members' RLS while only ever exposing these columns.
create view members_public as
  select id, first_name, last_name, active from members;

grant select on members_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- roster_segments: replace the free-text `member` column with a proper
-- FK, and open up authenticated writes (public read policy already
-- exists from migration 0002/0003).
-- ---------------------------------------------------------------------
truncate table roster_segments;

alter table roster_segments drop column member;

alter table roster_segments
  add column member_id uuid not null references members (id) on delete restrict;

create index roster_segments_member_id_idx on roster_segments (member_id);

create policy "Authenticated can insert roster_segments" on roster_segments
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated can update roster_segments" on roster_segments
  for update using (auth.role() = 'authenticated');
create policy "Authenticated can delete roster_segments" on roster_segments
  for delete using (auth.role() = 'authenticated');

-- Note: slot/role eligibility (crew_leader requires role_key='crew_chief',
-- driver requires 'driver' or 'emt') and the no-double-booking-a-slot rule
-- are validated at the app layer (see docs/duty_roster_administration.md
-- §"Minimum / maximum staffing"), not enforced here — the midnight-wrap
-- time math needed for a correct DB-level overlap constraint isn't worth
-- the complexity for this scale of app.

-- ---------------------------------------------------------------------
-- audit: one row per roster_segments change, populated by a trigger so
-- every write path is captured automatically.
-- ---------------------------------------------------------------------
create table audit (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid references members (id) on delete set null,
  action text not null check (action in ('added', 'removed', 'modified')),
  day_of_week text not null,
  shift text not null,
  role text not null,
  affected_member_id uuid references members (id) on delete set null,
  start_time text not null,
  end_time text not null,
  summary text not null,
  changed_at timestamptz not null default now()
);

alter table audit enable row level security;
create policy "Authenticated can read audit" on audit
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policies for any client role — the only writer
-- is the SECURITY DEFINER trigger function below, so the log is
-- effectively append-only and tamper-proof from the app side.

create function log_roster_segment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  acting_id uuid;
  acting_name text;
  affected_name text;
  act text;
  row_day text;
  row_shift text;
  row_role text;
  row_member_id uuid;
  row_start text;
  row_end text;
begin
  select id, first_name || ' ' || last_name into acting_id, acting_name
    from members where auth_user_id = auth.uid();

  if TG_OP = 'DELETE' then
    act := 'removed';
    row_day := OLD.day_of_week; row_shift := OLD.shift; row_role := OLD.role;
    row_member_id := OLD.member_id; row_start := OLD.start_time; row_end := OLD.end_time;
  elsif TG_OP = 'INSERT' then
    act := 'added';
    row_day := NEW.day_of_week; row_shift := NEW.shift; row_role := NEW.role;
    row_member_id := NEW.member_id; row_start := NEW.start_time; row_end := NEW.end_time;
  else
    act := 'modified';
    row_day := NEW.day_of_week; row_shift := NEW.shift; row_role := NEW.role;
    row_member_id := NEW.member_id; row_start := NEW.start_time; row_end := NEW.end_time;
  end if;

  select first_name || ' ' || last_name into affected_name
    from members where id = row_member_id;

  insert into audit (
    changed_by, action, day_of_week, shift, role,
    affected_member_id, start_time, end_time, summary
  ) values (
    acting_id, act, row_day, row_shift, row_role,
    row_member_id, row_start, row_end,
    coalesce(acting_name, 'Someone') || ' ' || act || ' ' ||
      coalesce(affected_name, 'someone') || ' to ' || initcap(row_day) || ' ' ||
      row_shift || ' ' || row_role || ' from ' || row_start || ' to ' || row_end
  );

  return coalesce(NEW, OLD);
end;
$$;

create trigger roster_segments_audit
  after insert or update or delete on roster_segments
  for each row execute function log_roster_segment_change();
