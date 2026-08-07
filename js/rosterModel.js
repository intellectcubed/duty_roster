// Component 1: data. Reads roster rows (Supabase or the CSV fallback) and
// shapes them into one JSON structure the renderer can draw directly from,
// with no further data logic of its own.
//
// Shape: an hour-by-hour grid, matching the reference template — each
// shift is 12 one-hour rows; a person's name repeats in every hour row
// they cover (not merged/spanned). Every shift always has exactly 12 rows
// regardless of how the coverage is split, so every day renders as the
// same fixed-size grid.
//
// This is the only module that combines dataSource.js (fetch) with
// roster.js (time math) — render.js never calls either directly.

import { DAYS, SHIFTS, SHIFT_ORDER, ROLES } from "./config.js";
import { loadRows } from "./dataSource.js";
import { buildSegments, groupRows, hhmmToMin, minToHhmm, SHIFT_MINUTES } from "./roster.js";

const HOUR_MARKS = Array.from({ length: SHIFT_MINUTES / 60 }, (_, i) => i * 60);

function formatHhmm(hhmm) {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

function clockLabelAt(shift, offsetMin) {
  return formatHhmm(minToHhmm(hhmmToMin(shift.start) + offsetMin));
}

// Which built segment covers a given hour-mark (0, 60, ..., 660).
function segmentAt(built, mark) {
  return built.find((seg) => seg.start <= mark && mark < seg.end);
}

function buildRole(role, rawRows, shift) {
  const built = buildSegments(rawRows, shift);
  return {
    key: role.key,
    label: role.label,
    cells: HOUR_MARKS.map((mark) => {
      const seg = segmentAt(built, mark);
      return {
        name: seg && !seg.uncovered ? seg.name : null,
        uncovered: !seg || !!seg.uncovered,
      };
    }),
  };
}

function buildShift(shiftKey, dayBucket) {
  const shift = SHIFTS[shiftKey];
  return {
    key: shiftKey,
    label: shiftKey === "day" ? "Day" : "Night",
    start: formatHhmm(shift.start),
    end: formatHhmm(shift.end),
    hours: HOUR_MARKS.map((mark) => clockLabelAt(shift, mark)),
    roles: ROLES.map((role) => buildRole(role, dayBucket?.[shiftKey]?.[role.key] ?? [], shift)),
  };
}

function buildDay(dayInfo, grouped) {
  return {
    key: dayInfo.key,
    label: dayInfo.label,
    shifts: SHIFT_ORDER.map((shiftKey) => buildShift(shiftKey, grouped[dayInfo.key])),
  };
}

// Always includes all seven days, in Monday..Sunday order, regardless of
// which days have data — this is a weekly template, not a specific week.
export async function loadRosterModel() {
  const rows = await loadRows();
  const grouped = groupRows(rows);
  return {
    days: DAYS.map((dayInfo) => buildDay(dayInfo, grouped)),
  };
}
