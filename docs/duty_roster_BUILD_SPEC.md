# Duty Roster — build spec (hourly grid design)

Self-contained specification for building the Martinsville Rescue Squad duty
roster view. Everything needed to implement the design is in this one file:
architecture, data model, layout, exact colors, and the time math. If you're
picking this up cold, build to this spec.

---

## 1. Goal

A static, printable web page that shows a week of EMS shifts as an
**hour-by-hour grid**, modeled directly on the squad's own Excel/Sheets
roster template (not invented from scratch): each day is one table, Day and
Night shifts side by side as column groups, one row per hour (12 rows per
shift side), role columns Crew Chief / EMT-Driver / Crew / Crew. A person's
name **repeats in every hour row they cover** — no merged/spanned cells.
Every day renders as the exact same fixed-size grid regardless of how that
day's coverage is split, so the whole week tiles predictably.

**Prime directive: the whole week fits on one printed page.** Screen shows
one column of day-grids (full width, easiest to read); print switches to
two columns of day-grids side by side purely to make that fit — same grid,
same markup, just narrower.

### Two components

1. **Data** (`js/rosterModel.js`) — reads Supabase (or the CSV fallback)
   and shapes it into one JSON structure: `{ days: [...] }`, fully
   pre-computed (gaps included, hour-by-hour, nothing left for the renderer
   to figure out). This is the only module that combines `dataSource.js`
   (fetch) with `roster.js` (time math).
2. **Renderer** (`js/render.js`) — pure JSON-to-DOM. Never touches
   Supabase, never does time math, never reaches into `dataSource.js` or
   `roster.js` directly — it only knows how to draw the model it's handed.

`js/main.js` wires them together and owns the Print button: clicking it
re-renders from the same model (not just an implicit `@media print`
restyle of whatever's already there) and then calls `window.print()` — an
explicit "render for printing" step, not a side effect of CSS alone.

### Design history (why this isn't the first attempt)

Three earlier designs were tried and dropped before this one:
- A colored-bar timeline (proportional-width bars on a shared time axis)
  couldn't fit one printed page at a readable size — 7 days x 2 shifts x 4
  bars rendered as 7 pages, confirmed by rendering to PDF.
- A single unified table (14 rows x 4 role columns, one row per day/shift)
  fixed the page-count problem but didn't match a real reference roster PDF
  the user later provided.
- A per-shift list (one section per day/shift, flag column for
  crew-leader/driver, one row per person) matched that reference PDF's
  *content* but not the user's own Excel template's *structure* — which
  turned out to be the more authoritative reference: Day/Night side by
  side, hourly rows, uniform grid size per day.

This design fixes both: it matches the user's own template's structure,
and (per instruction) trades that template's blank/hand-filled hourly rows
for programmatically-populated ones — with names repeating across covered
hours, not merged cells, and still fits one page.

---

## 2. Domain model

- **Two shifts per day.** `day` = 0600–1800, `night` = 1800–0600. The night
  shift **crosses midnight** — this drives all the time math below.
- **Four roles per shift**, one grid column each, in this order:
  `crew_leader` ("Crew Chief"), `driver` ("EMT/Driver"), `member_1`
  ("Crew"), `member_2` ("Crew").
- **Any role can be split** across people by hour. Example: crew leader
  ridden 1800–2300 by one person, 2300–0600 by another.
- Data is **one row per coverage segment**. A person covering a whole
  shift-role is one row; a split is 2+ rows for the same day/shift/role
  with different start/end times.
- **"Uncovered" is never entered.** Any hours in a shift-role with no
  assigned row are the complement, computed at render time.
- **Hour-aligned assumption.** The grid has one row per whole hour;
  start/end times are assumed to fall on hour boundaries (true of all
  sample/seed data). A sub-hour boundary would still be *stored* correctly
  but would round to the nearest hour row when displayed — not a concern
  for actual EMS shift scheduling, so not specially handled.

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
docs/duty_roster_administration.md — but the CSV fallback and the raw row
shape stay as above.)

### Worked split example (Monday night, member_1 handing off, ending early)

```
monday,night,member_1,R. Kansal,1800,2300
monday,night,member_1,T. O'Neil,2300,0000
monday,night,member_1,J. Edwards,0000,0500
```

Renders in Monday's Night/Crew column as: Kansal in the 1800–2200 rows (5
hours), O'Neil in the 2300 row (1 hour), Edwards in the 0000–0400 rows (5
hours), and the 0500 row shaded (uncovered) with no name.

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
any holes:

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

### From segments to hourly grid cells

`rosterModel.js` turns each role's segments into exactly 12 cells, one per
hour mark (`0, 60, 120, ..., 660`), by finding which segment covers each
mark:

```js
const HOUR_MARKS = Array.from({ length: SHIFT_MINUTES / 60 }, (_, i) => i * 60);

function segmentAt(built, mark) {
  return built.find(seg => seg.start <= mark && mark < seg.end);
}
```

A cell's `name` is `null` (and `uncovered: true`) when the covering segment
is itself an uncovered filler. This is what makes every shift exactly 12
rows regardless of split count — a split changes which *name* appears in a
row, never the *number* of rows.

---

## 4. Layout

One `<table class="day-grid">` per day. Column layout (10 data columns):

```
[Time][Crew Chief][EMT/Driver][Crew][Crew]  |  [Time][Crew Chief][EMT/Driver][Crew][Crew]
              DAY (0600-1800)                              NIGHT (1800-0600)
```

Three header rows, then 12 body rows:

```
┌────────────────────────  Monday  ────────────────────────┐
│      Day  0600-1800       │        Night  1800-0600       │
│ Time  CC   Dr   Cr   Cr   │  Time  CC   Dr   Cr   Cr      │
│ 06:00 Alex Morgan Dara Kai│  18:00 Pat  Rhea Taylor Jordan │
│ 07:00 Alex Morgan Dara Kai│  19:00 Pat  Rhea Taylor Jordan │
│  ...  (12 rows total)     │   ...  (12 rows total)         │
│ 17:00 Alex Morgan Dara Kai│  05:00 Pat  Rhea [gap] Jordan  │
└────────────────────────────────────────────────────────────┘
```

- **Row 1**: day name, spans all 10 columns.
- **Row 2**: "Day 0600–1800" (spans the 5 day columns) / "Night 1800–0600"
  (spans the 5 night columns) — the banners.
- **Row 3**: column headers, "Time" + the four role labels, repeated for
  each side.
- **Rows 4–15**: one per hour. The Time column shows that hour's clock
  label; each role column shows whoever is on duty then, or is shaded
  (uncovered) with no text.
- **A name is never merged/spanned across rows** — it's plain repeated
  text, exactly as the source template intends ("repeat the name for every
  hour scheduled").
- **Every day is the same size** (3 header rows + 12 body rows), regardless
  of splits or gaps — a split only changes *which* name shows in which
  rows, never the row count. This is what makes the day grids tile
  predictably in the multi-column container.

Container: `.roster-days` is a CSS grid of day-tables — `1fr` (one column,
full width) on screen, `1fr 1fr` (two columns) in print, purely to fit the
page. Same day-table markup either way.

---

## 5. Colors (exact)

- **Day title banner** (row 1): light blue `#dbe9fb` background, dark blue
  `#1a3d6d` bold text.
- **Day shift band** (row 2, day side): warm tan `#fff2cc` background,
  brown `#6b4f00` text.
- **Night shift band** (row 2, night side): near-black `#1c1c1c`
  background, white text — strong graphic contrast with the day side.
- **Column headers** (row 3): light gray `#f7f6f2` background, muted
  `#6b6a63` text, uppercase, small.
- **Uncovered cell**: light red `#fdecea` background fill, no text — with
  12 rows per role, a red *word* repeated on empty hours would be noisier
  than a color cue.
- Ink `#24231f`, muted `#6b6a63`, hairlines `#e3e1d8` (used for all cell
  borders — this is a fully bordered grid, not a hairline-underline list).

---

## 6. Print

Same DOM as screen, same CSS classes — only the column count and font
sizes change under `@media print`.

- `@page { size: landscape; margin: 10mm; }`
- Hide the toolbar.
- `.roster-days` switches from `grid-template-columns: 1fr` to `1fr 1fr`
  (two day-grids per row) — this is the "if necessary to print, two
  columns of days" concession; screen stays single-column since it isn't
  page-constrained.
- Smaller fonts throughout (down to ~7px for body cells) to fit two
  10-column grids side by side on a landscape half-page width. Known
  trade-off: at this density, long names (e.g. "Jordan Edwards") may
  ellipsis-truncate in print even though they display in full on screen —
  accepted for now since screen is the primary use case.
- `break-inside: avoid` is not needed on individual rows (a day-grid is
  small/uniform enough that day-tables don't split mid-table in practice at
  this scale), but each `.day-grid` is still one atomic unit in the grid
  container.

Verified via headless print-to-PDF: 1 page, all 7 days present (page count
+ extracted text), plus a rendered screenshot inspected directly — not just
visual confirmation in a browser tab.

---

## 7. File structure

```
index.html             entry page + toolbar (Print button, status)
css/styles.css          screen styles + @media print (landscape)
js/config.js            shift windows, role labels, Supabase URL/key   ← edit point
js/dataSource.js        fetches raw rows (Supabase or CSV fallback)
js/roster.js            time math: hhmmToMin, offsetInShift, buildSegments, groupRows (pure, testable)
js/rosterModel.js        composes dataSource.js + roster.js into the days->shifts->roles->cells JSON model
js/render.js             pure JSON-to-DOM: builds the day-grid <table>s from that model
js/main.js               bootstrap, wires the Print button to an explicit re-render + window.print()
data/sample-roster.csv   a full week in the schema above, used as fallback
```

---

## 8. Definition of done

- [x] Loads the sample CSV / Supabase data and renders all 7 day-grids with
      no console errors.
- [x] Day and Night render as side-by-side column groups within one
      day-table, not stacked sections.
- [x] Every day-grid is the same fixed size (3 header rows + 12 body rows)
      regardless of splits or gaps.
- [x] A split shows the correct name repeated across each hour row it
      covers — verified against the worked example (Kansal/O'Neil/Edwards
      hand-off).
- [x] An uncovered hour shows as a shaded cell, no text.
- [x] **Prime directive**: print preview is landscape, the whole week on
      one page — verified via headless print-to-PDF (page count +
      text-content check), not just eyeballed.
- [x] Screen is single-column (full width, most readable); print is
      two-column (fits the page) — same markup, CSS-only difference.
- [x] `buildSegments` output always tiles to 720 minutes (unit test).
- [x] Data (`rosterModel.js`) and rendering (`render.js`) are separate
      modules — render.js has no Supabase/time-math imports.
- [x] The Print button explicitly re-renders before calling
      `window.print()`.

---

## 9. Phase 2 (not built yet) — editing

A separate admin tool, outside this repo, that writes to the same
`roster_segments` Supabase table using the service_role/secret key (never
exposed client-side here). This site stays read-only.
