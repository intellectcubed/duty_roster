# Duty Roster — build spec (shift-list design)

Self-contained specification for building the Martinsville Rescue Squad duty
roster view. Everything needed to implement the design is in this one file:
data model, layout, exact colors, and the time math. If you're picking this
up cold, build to this spec.

---

## 1. Goal

A static, printable web page that shows a week of EMS shifts as **one
compact section per day/shift**, each a plain list of who's covering it —
modeled directly on a real squad's printed roster (a scanned reference PDF),
not invented from scratch. Sections flow through a 2-column (screen) /
3-column (print, landscape has more width) newspaper-style layout. The same
markup renders on screen and in print.

Two earlier designs were tried and dropped:
- A colored-bar timeline (proportional-width bars on a shared time axis)
  couldn't fit one printed page at a readable size — 7 days x 2 shifts x 4
  bars rendered as 7 pages, confirmed by rendering to PDF.
- A single unified table (14 rows x 4 role columns) fixed the page-count
  problem but didn't match what the user actually wanted once they compared
  it to a real reference roster.

This design:
- who is on each shift is visible at a glance — one section, one list,
- **split coverage** (two+ people covering different hours of one role)
  shows as consecutive rows, each with its own start/end time,
- **uncovered hours** show as a red "Uncovered" row with its time range —
  no separate visual language needed, it's just another row,
- a small flag column (`*` = crew leader, `d` = driver, blank = member)
  substitutes for the role-column-per-role structure other designs used.

No build step. Plain HTML/CSS/ES-modules served by GitHub Pages, reading
Supabase (falls back to a bundled CSV sample when unconfigured).

This is a **recurring weekly template**, not a roster tied to a specific
calendar week — days are labeled Monday..Sunday, with no date. (The real
reference roster this is modeled on only lists shifts that have assigned
crew for that week; this site always shows all 14 day/shift sections,
including empty ones marked "Uncovered" — visibility into gaps matters more
here than matching that particular omission.)

---

## 2. Domain model

- **Two shifts per day.** `day` = 0600–1800, `night` = 1800–0600. The night
  shift **crosses midnight** — this drives all the time math below.
- **Four roles per shift**, one grid column each, in this order:
  `crew_leader`, `driver`, `member_1`, `member_2`.
- **Any role can be split** across people by hour. Example: crew leader ridden
  1800–2300 by one person, 2300–0600 by another.
- Data is **one row per coverage segment**. A person covering a whole shift-role
  is one row; a split is 2+ rows for the same day/shift/role with different
  start/end times.
- **"Uncovered" is never entered.** Any hours in a shift-role with no assigned
  row are the complement, computed at render time.

### Data schema (Supabase table / CSV — one flat table)

| column   | meaning                                | example      |
| -------- | -------------------------------------- | ------------ |
| `day`    | lowercase weekday name                 | `monday`     |
| `shift`  | `day` or `night`                       | `night`      |
| `role`   | `crew_leader`/`driver`/`member_1`/`member_2` | `member_1` |
| `member` | display name                           | `R. Kansal`  |
| `start`  | 24h `HHMM`, inclusive                  | `1800`       |
| `end`    | 24h `HHMM`, exclusive                  | `2300`       |

Header row must be exactly those six lowercase names. Night-shift `end` is
`0600`, not `3000`. Day order for rendering is a fixed constant
(Monday..Sunday), not derived from the data. (Supabase reads join through a
`member_id` FK instead of the flat `member` text column — see
docs/duty_roster_administration.md — but the CSV fallback and the row shape
used by rendering code stay as above.)

### Worked split example (Monday night, member_1 handing off, ending early)

```
monday,night,member_1,R. Kansal,1800,2300
monday,night,member_1,T. O'Neil,2300,0000
monday,night,member_1,J. Edwards,0000,0500
```

Renders in the Monday-night section as three consecutive rows (Kansal,
O'Neil, Edwards — each with its own start/end time) followed by a fourth
row, `Uncovered` / `05:00`–`06:00`, in red.

---

## 3. Time math (the core; keep it pure and tested)

Represent every clock time as **minutes from the shift's start**, 0–720
(`SHIFT_MINUTES = 720`). This collapses the midnight-wrap problem.

```js
const SHIFT_MINUTES = 720;

// "0600"/"600"/6 -> minutes since midnight
function hhmmToMin(hhmm) {
  const s = String(hhmm).trim().padStart(4, '0');
  return (+s.slice(0, 2)) * 60 + (+s.slice(2, 4));
}

// where a clock time falls inside a shift, 0..720, handling the midnight wrap.
// shift start -> 0; the shift's own end -> 720 (not 0).
function offsetInShift(hhmm, shift) {
  const t = hhmmToMin(hhmm), s = hhmmToMin(shift.start);
  const off = ((t - s) + 1440) % 1440;
  return off === 0 && t !== s ? SHIFT_MINUTES : off;
}
```

Expected values (night = start 1800): 1800→0, 2300→300, 0000→360, 0600→720.
Day (start 0600): 0600→0, 1800→720.

### Build segments with gap-fill

For one role in one shift, turn its rows into an ordered list of segments
that **tiles the full 720 minutes**, inserting `{uncovered:true}` fillers in
any holes. This is still needed with a grid — it's how a cell knows whether
a role is a single full-shift assignment (show just the name, no times) vs.
a split or a gap (show each entry with its own time range):

```js
function buildSegments(rows, shift) {
  const segs = (rows || [])
    .map(r => ({
      name: r.member,
      start: offsetInShift(r.start, shift),
      end: offsetInShift(r.end, shift) || SHIFT_MINUTES,
    }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const out = []; let cursor = 0;
  for (const s of segs) {
    if (s.start > cursor) out.push({ uncovered: true, start: cursor, end: s.start });
    out.push(s);
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < SHIFT_MINUTES) out.push({ uncovered: true, start: cursor, end: SHIFT_MINUTES });
  return out;
}
```

Invariant to test: the returned segments' durations sum to exactly 720.

To display a segment's actual clock time (e.g. "18:00–23:00"), convert its
offset back: `minToHhmm(hhmmToMin(shift.start) + segment.start)`.

---

## 4. Layout

14 `<section>`s (7 days x 2 shifts, in that order), flowed through a
multi-column container (`column-count: 2` screen, `3` print):

```
Monday — Day Crew                                    06:00–18:00
─────────────────────────────────────────────────────────────────
*  Alex Alvarez                                    06:00      18:00
d  Morgan Chen                                      06:00      18:00
   Dara Osei                                          06:00      18:00
   Kai Flores                                          06:00      18:00

Monday — Night Crew                                  18:00–06:00
─────────────────────────────────────────────────────────────────
*  Pat Whitfield                                    18:00      06:00
d  Rhea Kansal                                       18:00      06:00
   Taylor O'Neil                                     18:00      23:00
   Noor Ibarra                                        23:00      00:00
   Sam Delgado                                        00:00      05:00
   Uncovered                                          05:00      06:00
   Jordan Edwards                                    18:00      06:00
```

- **Section title**: `"{Day} — {Day|Night} Crew"` plus the shift's time
  range on the right (colored — amber for day, blue for night).
- **Each row**: a one-character flag column (`*` crew_leader, `d` driver,
  blank for member_1/member_2), the name (or `Uncovered`), then separate
  start and end columns (not a combined string — matches the reference).
  Times are italic, muted.
- **Row order within a section**: `ROLES` order (crew_leader, driver,
  member_1, member_2); within a role, `buildSegments` order (chronological,
  gaps included). A split shows as consecutive rows sharing that role's
  flag; a gap is a row with name `"Uncovered"`, styled red.
- No per-person color, no chip, no proportional-width bars, no axis, no
  per-segment label-fitting — the reference roster this is modeled on is
  plain black-and-white text, and it's what a printer-friendly roster
  should look like anyway.

---

## 5. Colors (exact)

Deliberately minimal — the reference this is modeled on is plain
black-and-white text, which also prints cleanly on any printer:

- **Uncovered:** red text (`#b4261f`) for both the name and time cells.
- **Section title accents:** day = `#854F0B` (amber), night = `#0C447C`
  (blue).
- Ink `#24231f`, muted `#6b6a63` (flags, times), hairlines `#e3e1d8`.

---

## 6. Print

Same DOM as screen — no separate compact mode, no JS reflow pass needed on
`resize`/`beforeprint` (a plain list doesn't need label-fitting at any
width).

- `@page { size: landscape; margin: 10mm; }`
- Hide the toolbar; `column-count: 3` (more width available in landscape
  than the screen's 2-column layout); smaller fonts than screen.
- `break-inside: avoid` on each `.shift-section` so one never splits across
  a column or page break.

Verified via headless print-to-PDF: 1 page, all 7 days present (page count
+ extracted text), plus a rendered screenshot compared against the
reference roster's layout — not just visual inspection in a browser tab.

---

## 7. File structure

```
index.html            entry page + toolbar (Print button, status)
css/styles.css        screen styles + @media print (landscape)
js/config.js          shift windows, roles, Supabase URL/key   ← edit point
js/dataSource.js      the ONLY module that fetches data        ← phase-2 seam
js/roster.js          time math, buildSegments, grouping (pure, testable)
js/render.js          builds the day/shift <section>s + crew-list <table>s
js/main.js            bootstrap, print button
data/sample-roster.csv  a full week in the schema above
```

`dataSource.loadRows()` fetches from Supabase's REST API (public/publishable
key, gated by a read-only RLS policy), or the bundled sample CSV when no
Supabase URL is configured, and returns normalized rows.

---

## 8. Definition of done

- [x] Loads the sample CSV / Supabase data and renders all 14 sections with
      no console errors.
- [x] A split role shows one row per person with each one's own start/end;
      a non-split role shows one row, no redundant time repeated elsewhere.
- [x] A gap shows as a red "Uncovered" row with its time range.
- [x] Crew leader and driver rows show their flag (`*` / `d`); member rows
      don't.
- [x] Print preview is landscape, one week on one page, no shift section
      split across pages — verified via headless print-to-PDF (page count
      + text-content check).
- [x] `buildSegments` output always tiles to 720 minutes (unit test).
- [x] Screen and print render the same structure — no separate compact
      mode to keep in sync.
- [x] Layout matches the reference roster PDF this is modeled on (2/3
      -column shift-list style), confirmed by side-by-side comparison.

---

## 9. Phase 2 (not built yet) — editing

A separate admin tool, outside this repo, that writes to the same
`roster_segments` Supabase table using the service_role/secret key (never
exposed client-side here). This site stays read-only.
