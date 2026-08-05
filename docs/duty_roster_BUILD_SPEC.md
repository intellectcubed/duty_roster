# Duty Roster — build spec (colored-bar design)

Self-contained specification for building the Martinsville Rescue Squad duty
roster view. Everything needed to implement the design is in this one file:
data model, layout, exact colors, the adaptive-label algorithm, and the time
math. If you're picking this up cold, build to this spec.

---

## 1. Goal

A static, printable web page that shows a week of EMS shifts. Each shift is
drawn as a set of horizontal **colored bars** on a shared time axis, so that:

- who is on each role is visible at a glance,
- **split coverage** (two people covering different hours of one role) shows as
  two colored segments in the same bar, and
- **uncovered hours** show as a hatched gap.

No build step. Plain HTML/CSS/ES-modules served by GitHub Pages, reading
Supabase (falls back to a bundled CSV sample when unconfigured).

This is a **recurring weekly template**, not a roster tied to a specific
calendar week — days are labeled Monday..Sunday, with no date.

---

## 2. Domain model

- **Two shifts per day.** `day` = 0600–1800, `night` = 1800–0600. The night
  shift **crosses midnight** — this drives all the time math below.
- **Four roles per shift**, drawn top to bottom in this order:
  `crew_leader`, `driver`, `member_1`, `member_2`.
- **Any role can be split** across people by hour. Example: crew leader ridden
  1800–2300 by one person, 2300–0600 by another.
- Data is **one row per coverage segment**. A person covering a whole shift-role
  is one row; a split is 2+ rows for the same day/shift/role with different
  start/end times.
- **"Uncovered" is never entered.** Any hours in a shift-role with no assigned
  row are the complement, computed at render time and drawn as a gap.

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
(Monday..Sunday), not derived from the data.

### Worked split example (Monday night, member_1 handing off, ending early)

```
monday,night,member_1,R. Kansal,1800,2300
monday,night,member_1,T. O'Neil,2300,0000
monday,night,member_1,J. Edwards,0000,0500
```

Renders as three colored segments (Kansal, O'Neil as a ~1h sliver, Edwards)
followed by a hatched **uncovered** gap from 0500–0600.

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

For one role in one shift, turn its rows into an ordered list of segments that
**tiles the full 720 minutes**, inserting `{uncovered:true}` fillers in any
holes:

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

---

## 4. Layout

```
Day heading  (e.g. "Monday" — weekday name only, no date)
  Shift block: day
    shift head:  "day   0600–1800"
    axis:        [role-label spacer][ 1800  2100  0000  0300  0600 ]  ← shared ticks
    bar row:     [Crew ldr][ ============ track of segments ============ ]
    bar row:     [Driver  ][ ============================================ ]
    bar row:     [Member 1][ ============================================ ]
    bar row:     [Member 2][ ============================================ ]
    shift key:   (only if any name was abbreviated to initials)
  Shift block: night
    ...
```

- The **role-label column is fixed width** (~84px) so all four tracks share the
  same left edge, and therefore the same time scale as the axis above them.
- Each **track** is a flex row. Each **segment** is `flex: <durationMinutes> 1 0`
  so width is proportional to hours. All tracks use the same total, so a given
  clock time sits at the same x across all four bars — which is why the axis can
  be drawn once at the top.
- **Each segment shows two lines:** the person's name (or its abbreviated
  form — see ยง6), and below it, smaller and muted, its own start–end clock
  time (e.g. "18:00–23:00"), computed from the segment's offset, not the
  axis. The time line fits independently of the name line — on a narrow
  segment the name may still show initials while the time line hides
  entirely if it doesn't fit. Uncovered segments show neither line.

### Axis ticks

Five labels evenly across the shift (every 3h): for night, `1800 2100 0000 0300
0600`. Compute as `minToHhmm(shiftStartMin + i * 180)` for i in 0..4.

---

## 5. Colors (exact)

Each **person** gets a deterministic color: hash the name to an index into this
palette (soft background + readable foreground):

```js
const PALETTE = [
  { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#E6F1FB', fg: '#0C447C' }, { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#EAF3DE', fg: '#27500A' }, { bg: '#FBEAF0', fg: '#72243E' },
  { bg: '#FAECE7', fg: '#993C1D' }, { bg: '#F1EFE8', fg: '#444441' },
];
function colorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
```

- **Uncovered segment:** diagonal coral hatch, no text —
  `repeating-linear-gradient(45deg, transparent 0 5px, rgba(216,90,48,0.14) 5px 10px)`.
- **Shift-title accents:** day = `#854F0B` (amber), night = `#0C447C` (blue).
- **Segment separators:** 1px white right-border between adjacent segments;
  track has a 0.5px `#e3e1d8` border, 4px radius, overflow hidden.
- Ink `#24231f`, muted `#6b6a63`, faint `#9a988f`, hairlines `#e3e1d8`.

Bars are ~36px tall on screen, ~30px in print (two lines of text).

---

## 6. Adaptive labels — the narrow-segment solution

This is the crux of the design. A short segment can't fit a full name, so
**measure the rendered width and step down a ladder**, after layout — never
guess at authoring time.

For each rendered non-uncovered segment:

1. `avail = segment.clientWidth - 8` (px, accounts for padding).
2. Candidate ladder, widest first:
   `[fullName, "F. Last", "Last", initials]`.
3. Measure each with a canvas 2D context using the **same font as the CSS**
   (`12px system-ui, -apple-system, "Segoe UI", sans-serif`). Pick the first
   candidate whose measured width ≤ `avail`.
4. If even initials don't fit: render a **blank colored swatch** and add
   `INITIALS = Full Name` to that shift's key line.
5. If the chosen label is the initials form (and not the full name), also add it
   to the key so the abbreviation is decodable.

Name-form helpers: tokens = split on spaces/commas/periods. `initials` = first
letter of first + last token (or first two letters if single token). `F. Last` =
first initial + last token. `Last` = last token.

```js
let _ctx;
function measure(text) {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  _ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
  return _ctx.measureText(text).width;
}
function fitLabels(root) {
  root.querySelectorAll('.seg[data-name]').forEach(span => {
    const name = span.dataset.name;
    const avail = span.clientWidth - 8;
    const ladder = [name, firstInitialLast(name), lastName(name), initials(name)];
    const chosen = ladder.find(c => measure(c) <= avail);
    if (chosen === undefined) { span.textContent = ''; span.classList.add('seg-swatch'); addToKey(span, initials(name), name); }
    else { span.textContent = chosen; if (chosen === initials(name) && chosen !== name) addToKey(span, initials(name), name); }
  });
}
```

**Re-run `fitLabels` on:** initial render (inside `requestAnimationFrame`),
window resize (debounce ~120ms), and `beforeprint` — so the print layout gets
its own fit pass at landscape width.

---

## 7. Print

- `@page { size: landscape; margin: 12mm; }`
- Hide the toolbar; remove page padding; shrink bar height to ~30px, name to
  11px, time line to 8px.
- `break-inside: avoid` on day blocks and shift blocks so a shift never splits
  across a page break.
- A week (7 days × 2 shifts × 4 bars) fits one landscape sheet at these sizes.

---

## 8. File structure

```
index.html            entry page + toolbar (Print button, status)
css/styles.css        screen styles + @media print (landscape)
js/config.js          data source URL, shift windows, roles   ← edit point
js/dataSource.js      the ONLY module that fetches data        ← phase-2 seam
js/roster.js          time math, buildSegments, grouping (pure, testable)
js/render.js          DOM bars + fitLabels
js/main.js            bootstrap, print, resize/beforeprint reflow
data/sample-roster.csv  a full week in the schema above
```

`dataSource.loadRows()` fetches from Supabase's REST API (public/publishable
key, gated by a read-only RLS policy), or the bundled sample CSV when no
Supabase URL is configured, and returns normalized rows.

---

## 9. Definition of done

- [ ] Loads the sample CSV and renders a week with no console errors.
- [ ] Night shift renders left-to-right 1800→0600 with correct segment widths
      (2300 sits at 5/12 across, not wrapped).
- [ ] A 1-hour split segment shows initials; its full name appears in the shift
      key.
- [ ] An early-ending role shows a hatched uncovered gap for the remaining hours.
- [ ] Each person's color is stable across the week (same name → same color).
- [ ] Print preview is landscape, one week per page, no shift split across pages.
- [ ] `buildSegments` output always tiles to 720 minutes (unit test).

---

## 10. Phase 2 (not built yet) — editing

A separate admin tool, outside this repo, that writes to the same
`roster_segments` Supabase table using the service_role/secret key (never
exposed client-side here). This site stays read-only.

## Open question

Four bars per shift is generous vertically when most shifts aren't split.
Consider a **compact mode**: draw a full bar only when a role is actually split,
and collapse a single-person role to one name line. Decide once real data shows
how often splits occur, or if two weeks must fit one page.
