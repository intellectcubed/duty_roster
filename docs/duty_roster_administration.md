# Duty roster administrator
This is a web page that allows crew chiefs to  maintain the roster as changes arise.  

The roster shows the shift schedule.  Each shift can have minimum of 2 members, one of whom is an EMT/Crew Chief, the other is an EMT/Driver.  There can be a maximum of 4 members.  Roles can be: EMT/Crew Chief, EMT, Driver, Assistant, Cadet.  

Shifts are for a given day of week (example: every Monday): Day Shift: 0600 - 1800.  Night shift is 1800 - 0600.  Shifts are scheduled for every day of the week.  shift slots can be split by hour.  For example, on a shift, we could have a Crew Chief on the schedule for one hour from 0600 - 0700, then another member can fill out the rest of the slot: 0700 - 1800.

For inputting shifts, there should be a drop down for member name, a drop down for role, start/end times (it should be easy to select 0600 - 0900, 0900 - 1200, 0600 - 1200, 0600 - 1800, etc.), or select specific hour/end.

## Roles

Two role concepts, easy to conflate — kept separate on purpose:

- **Slot** — the four fixed structural positions on a shift (matches the
  display site's bar layout): `crew_leader`, `driver`, `member_1`,
  `member_2`.
- **Member role** — a property of a *person*: `EMT/Crew Chief`, `EMT`,
  `Driver`, `Assistant`, `Cadet`. One value per member (their highest
  qualification), not multi-select.

Which member roles are eligible for which slot:

| slot          | eligible member roles          |
| ------------- | ------------------------------- |
| `crew_leader` | `EMT/Crew Chief`                |
| `driver`      | `Driver` or `EMT`                |
| `member_1`    | any                              |
| `member_2`    | any                              |

The member/role dropdowns (below) cross-filter each other per this table —
you can't save an assignment where the chosen member's role isn't eligible
for the chosen slot.

### Minimum / maximum staffing

- **Minimum (soft warning, doesn't block saving).** If the `crew_leader`
  slot's segments don't cover the *entire* shift, or the `driver` slot
  doesn't either, show a red warning on that shift: "Shift does not have
  minimum staff." This is the same "uncovered gap" computation the display
  site already does for rendering — no new logic, just check whether either
  slot has any uncovered gap across the full shift.
- **Maximum of 4 (hard block).** Since there are exactly 4 slots, the only
  way to exceed 4 concurrent people is by double-booking a slot — so the
  actual rule to enforce is: reject a segment whose start/end overlaps an
  existing segment in the *same* day+shift+slot.

### Auditing
We will create an auditing table.  Each time a change is made to the roster, the change will be recorded to the audit table.  (for example: `Member: Jim Ross added Veronica to Monday shift from 1800 - 1900`.  or `Member: Lou DiGiovanni removed Claire from Tuesday shift from 0600 - 0700`) -- I don't mean that these exact literals should be captured, only the actions.  It should be possible to know who made what change to any shift.

Recommend populating this with a Postgres trigger on `roster_segments`
(insert/update/delete), rather than the app writing to `audit` explicitly —
a trigger catches every write regardless of code path, so the log can't
drift out of sync with reality.

### UX
At the top of the screen, there will be a dropdown to select day of week.  Then shift (day/night).  Once those have been selected, query Supabase and get the schedule for that day.  Display that schedule using the bar representation used for the duty roster.

Below the bars representing the shift, show the input fields: Name, Role, Start, End (and provide an easy way to select common start/end slots - or specific hours).  Then an apply button.   

When apply is pressed the bars will update to reflect the change.

Clicking on the bars will populate the fields below it as appropriate. The user can then modify the start/end times and/or role, then press Save.  Or they can delete.

The red minimum-staffing warning (above) shows above the bars whenever the
currently displayed day+shift is understaffed.

## Architecture
Front end: Next.js, static export (`output: "export"`) — no Node server at
runtime; all data/auth calls go straight from the client to Supabase.
Server: static hosting only (e.g. GitHub Pages).
Database: Supabase

## Authentication
Authentication can be handled by Supabase.  Users will be added by an administrator and they will have to log in with their email address and set up their account.  (I believe we can have Supabase send an email to each new member and they can handle the setup)

Invites are manual — the administrator invites via the Supabase dashboard
(Authentication → Users → Invite). No in-app "add user" flow, which also
means the app never needs the `service_role`/secret key.

Single permission tier: anyone who was invited and successfully logs in can
modify the entire roster. No distinction between crew chief and any other
role, no per-user scoping to specific shifts.

## Database
### Table: members 
Note: These are members that can be added to a shift.

Attributes: 
- first name
- middle name
- last name
- highest role: fk to roles
- phone number
- active (boolean)

(also: `auth_user_id`, nullable FK to `auth.users` — links a member to
their Supabase Auth account once they've logged in at least once)

### Table: roles
Lookup table for the five member roles in §"Roles" above.

Attributes:
- key (e.g. `crew_chief`, `emt`, `driver`, `assistant`, `cadet`)
- label (e.g. "EMT/Crew Chief")

### Table: roster_segments (existing — needs a change)
Already exists for the display site. Its `member` column (free text) needs
to become `member_id` (FK to `members`) so the admin dropdown works against
real records. This also means the display site's data-fetching needs a
small update to join `members` for the display name instead of reading
plain text — noted here so it isn't a surprise, not otherwise in scope for
this doc.

### Table: audit
Attributes:
- member
- changed_by: fk to members (who made the change)
- action: `added` / `removed` / `modified`
- day of week, shift, slot (role) — which bar the change was on
- affected member: fk to members (whose assignment changed) — nullable, for
  edits that only change times/role and not the person
- start time / end time (the segment's times at the time of the change)
- changed_at (timestamp)
- summary: human-readable text generated from the above at write time
  (this is what directly produces the example messages above, without the
  UI having to reconstruct a sentence from raw columns)

## Decisions

- **Members table is app-managed.** Any logged-in user can add/edit entries
  in `members` (name, role, phone, active) through the app — a "Members"
  screen alongside the roster editor. Unlike invites, this doesn't need the
  secret key, so there's no reason to push it out to manual Supabase Studio
  edits.
- **Minimum-staffing warning is admin-tool only.** The public read-only
  display site stays exactly as it is — no warning banner there.
