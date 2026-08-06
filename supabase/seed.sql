-- Sample data for local development / demos. Safe to re-run.

delete from roster_segments;
delete from members;

insert into members (first_name, last_name, role_key, email, active) values
  ('Alex', 'Alvarez', 'crew_chief', 'alex.alvarez@example.com', true),
  ('Morgan', 'Chen', 'driver', 'morgan.chen@example.com', true),
  ('Dara', 'Osei', 'assistant', 'dara.osei@example.com', true),
  ('Kai', 'Flores', 'cadet', 'kai.flores@example.com', true),
  ('Pat', 'Whitfield', 'crew_chief', 'pat.whitfield@example.com', true),
  ('Rhea', 'Kansal', 'emt', 'rhea.kansal@example.com', true),
  ('Jordan', 'Edwards', 'assistant', 'jordan.edwards@example.com', true),
  ('Taylor', 'O''Neil', 'emt', 'taylor.oneil@example.com', true),
  ('Noor', 'Ibarra', 'cadet', 'noor.ibarra@example.com', true),
  ('Sam', 'Delgado', 'assistant', 'sam.delgado@example.com', true);

-- Day shift crew (0600-1800), assigned every day of the week.
insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'day', 'crew_leader', (select id from members where first_name = 'Alex' and last_name = 'Alvarez'), '0600', '1800'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'day', 'driver', (select id from members where first_name = 'Morgan' and last_name = 'Chen'), '0600', '1800'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'day', 'member_1', (select id from members where first_name = 'Dara' and last_name = 'Osei'), '0600', '1800'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'day', 'member_2', (select id from members where first_name = 'Kai' and last_name = 'Flores'), '0600', '1800'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

-- Night shift crew (1800-0600): crew_leader/driver/member_2 assigned every
-- night; member_1 below (whole-shift on most nights, split on Monday).
insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'night', 'crew_leader', (select id from members where first_name = 'Pat' and last_name = 'Whitfield'), '1800', '0600'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'night', 'driver', (select id from members where first_name = 'Rhea' and last_name = 'Kansal'), '1800', '0600'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'night', 'member_2', (select id from members where first_name = 'Jordan' and last_name = 'Edwards'), '1800', '0600'
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time)
select day, 'night', 'member_1', (select id from members where first_name = 'Taylor' and last_name = 'O''Neil'), '1800', '0600'
from unnest(array['tuesday','wednesday','thursday','friday','saturday','sunday']) as day;

-- Monday night member_1: a three-way handoff that ends early, leaving
-- 0500-0600 uncovered (renders as a hatched gap). The 2300-0000 segment
-- is a one-hour sliver, narrow enough to demonstrate the adaptive label.
insert into roster_segments (day_of_week, shift, role, member_id, start_time, end_time) values
  ('monday', 'night', 'member_1', (select id from members where first_name = 'Taylor' and last_name = 'O''Neil'), '1800', '2300'),
  ('monday', 'night', 'member_1', (select id from members where first_name = 'Noor' and last_name = 'Ibarra'), '2300', '0000'),
  ('monday', 'night', 'member_1', (select id from members where first_name = 'Sam' and last_name = 'Delgado'), '0000', '0500');
