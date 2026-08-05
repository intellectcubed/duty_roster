-- Sample data for local development / demos. Safe to re-run (idempotent
-- deletes any prior sample week before inserting).

delete from roster_segments where duty_date between '2026-08-03' and '2026-08-09';

-- Day shift crew (0600-1800), assigned every day of the sample week.
insert into roster_segments (duty_date, shift, role, member, start_time, end_time)
select d::date, 'day', role, member, '0600', '1800'
from generate_series('2026-08-03'::date, '2026-08-09'::date, interval '1 day') as d
cross join (values
  ('crew_leader', 'A. Alvarez'),
  ('driver',      'M. Chen'),
  ('member_1',    'D. Osei'),
  ('member_2',    'K. Flores')
) as crew(role, member);

-- Night shift crew (1800-0600): crew_leader/driver/member_2 assigned every
-- night; member_1 below (whole-shift on most nights, split on Monday).
insert into roster_segments (duty_date, shift, role, member, start_time, end_time)
select d::date, 'night', role, member, '1800', '0600'
from generate_series('2026-08-03'::date, '2026-08-09'::date, interval '1 day') as d
cross join (values
  ('crew_leader', 'P. Whitfield'),
  ('driver',      'R. Kansal'),
  ('member_2',    'J. Edwards')
) as crew(role, member);

insert into roster_segments (duty_date, shift, role, member, start_time, end_time)
select d::date, 'night', 'member_1', 'T. O''Neil', '1800', '0600'
from generate_series('2026-08-04'::date, '2026-08-09'::date, interval '1 day') as d;

-- Monday night member_1: a three-way handoff that ends early, leaving
-- 0500-0600 uncovered (renders as a hatched gap). The 2300-0000 segment
-- is a one-hour sliver, narrow enough to demonstrate the adaptive label.
insert into roster_segments (duty_date, shift, role, member, start_time, end_time) values
  ('2026-08-03', 'night', 'member_1', 'T. O''Neil',  '1800', '2300'),
  ('2026-08-03', 'night', 'member_1', 'N. Ibarra',   '2300', '0000'),
  ('2026-08-03', 'night', 'member_1', 'S. Delgado',  '0000', '0500');
