-- The roster website has no login flow — it's a public read-only display.
-- Replace the authenticated-only read policies with public (anon) read access.
-- Writes still require the service_role / secret key from the separate admin tool.

drop policy if exists "Authenticated users can read staff" on staff;
drop policy if exists "Authenticated users can read shifts" on shifts;
drop policy if exists "Authenticated users can read roster_entries" on roster_entries;

create policy "Public can read staff" on staff
  for select using (true);

create policy "Public can read shifts" on shifts
  for select using (true);

create policy "Public can read roster_entries" on roster_entries
  for select using (true);
