-- This is a recurring weekly template, not a roster for a specific week —
-- replace the calendar duty_date with a day-of-week key.

truncate table roster_segments;

alter table roster_segments drop column duty_date;

alter table roster_segments
  add column day_of_week text not null
  check (day_of_week in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));

drop index if exists roster_segments_duty_date_idx;
create index roster_segments_day_of_week_idx on roster_segments (day_of_week);
