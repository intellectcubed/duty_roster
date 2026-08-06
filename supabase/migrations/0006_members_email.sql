-- members had no email column, but login is by email (magic link) and the
-- audit trail needs to link a logged-in auth.users account back to a
-- members row (see docs/duty_roster_administration.md §Authentication).
-- Nullable + unique: a member record can exist before they're invited.

alter table members add column email text unique;
