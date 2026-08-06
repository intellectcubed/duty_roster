// Pure time math + grouping. No DOM access — keep this testable with plain
// `node --test`.

export const SHIFT_MINUTES = 720;

// "0600"/"600"/6 -> minutes since midnight
export function hhmmToMin(hhmm) {
  const s = String(hhmm).trim().padStart(4, "0");
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4));
}

// Where a clock time falls inside a shift, 0..720, handling the midnight
// wrap. Shift start -> 0; the shift's own end -> 720 (not 0).
export function offsetInShift(hhmm, shift) {
  const t = hhmmToMin(hhmm);
  const s = hhmmToMin(shift.start);
  const off = ((t - s) + 1440) % 1440;
  return off === 0 && t !== s ? SHIFT_MINUTES : off;
}

// Turns one role's raw coverage rows into an ordered list of segments that
// tiles the full 720 minutes, inserting `{ uncovered: true }` fillers in any
// holes. Invariant: durations always sum to exactly 720.
export function buildSegments(rows, shift) {
  const segs = (rows || [])
    .map((r) => ({
      name: r.member,
      start: offsetInShift(r.start, shift),
      end: offsetInShift(r.end, shift) || SHIFT_MINUTES,
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const out = [];
  let cursor = 0;
  for (const s of segs) {
    if (s.start > cursor) out.push({ uncovered: true, start: cursor, end: s.start });
    out.push(s);
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < SHIFT_MINUTES) out.push({ uncovered: true, start: cursor, end: SHIFT_MINUTES });
  return out;
}

// { [dayKey]: { [shiftKey]: { [roleKey]: rawRow[] } } }
// Day order is a fixed weekly template (config.js DAYS), not derived here.
export function groupRows(rows) {
  const grouped = {};
  for (const row of rows) {
    const dayBucket = (grouped[row.day] ??= {});
    const shiftBucket = (dayBucket[row.shift] ??= {});
    (shiftBucket[row.role] ??= []).push(row);
  }
  return grouped;
}

export function minToHhmm(min) {
  const wrapped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}
