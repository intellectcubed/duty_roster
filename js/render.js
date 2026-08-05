// DOM rendering: colored bars on a shared time axis, plus the adaptive
// label-fitting pass. No data fetching here — takes already-grouped rows.

import { ROLES, SHIFTS, SHIFT_ORDER, DAYS } from "./config.js";
import { buildSegments, axisTicks, hhmmToMin, minToHhmm } from "./roster.js";

const PALETTE = [
  { bg: "#EEEDFE", fg: "#3C3489" },
  { bg: "#E1F5EE", fg: "#0F6E56" },
  { bg: "#E6F1FB", fg: "#0C447C" },
  { bg: "#FAEEDA", fg: "#854F0B" },
  { bg: "#EAF3DE", fg: "#27500A" },
  { bg: "#FBEAF0", fg: "#72243E" },
  { bg: "#FAECE7", fg: "#993C1D" },
  { bg: "#F1EFE8", fg: "#444441" },
];

function colorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function tokens(name) {
  return name.split(/[\s,.]+/).filter(Boolean);
}

function initialsOf(name) {
  const t = tokens(name);
  if (t.length === 1) return t[0].slice(0, 2).toUpperCase();
  return (t[0][0] + t[t.length - 1][0]).toUpperCase();
}

function firstInitialLastOf(name) {
  const t = tokens(name);
  if (t.length === 1) return t[0];
  return `${t[0][0]}. ${t[t.length - 1]}`;
}

function lastNameOf(name) {
  const t = tokens(name);
  return t[t.length - 1];
}

function formatHhmm(hhmm) {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

// Converts a segment's shift-relative offset (0..720) back to a real clock
// time for display, e.g. offset 300 into the night shift (starts 1800) -> "21:00".
function clockLabelAt(shift, offsetMin) {
  return formatHhmm(minToHhmm(hhmmToMin(shift.start) + offsetMin));
}

function buildSegmentEl(seg, shift) {
  const span = document.createElement("span");
  span.className = "seg";
  span.style.flex = `${seg.end - seg.start} 1 0`;

  if (seg.uncovered) {
    span.classList.add("seg-uncovered");
    return span;
  }

  const { bg, fg } = colorFor(seg.name);
  span.style.background = bg;
  span.style.color = fg;
  span.dataset.name = seg.name;

  const nameEl = document.createElement("span");
  nameEl.className = "seg-name";
  nameEl.textContent = seg.name; // fitLabels shrinks this once real widths exist

  const timeEl = document.createElement("span");
  timeEl.className = "seg-time";
  const timeText = `${clockLabelAt(shift, seg.start)}–${clockLabelAt(shift, seg.end)}`;
  timeEl.dataset.time = timeText;
  timeEl.textContent = timeText; // fitLabels hides this if it doesn't fit

  span.append(nameEl, timeEl);
  return span;
}

function buildTrack(rows, shift) {
  const track = document.createElement("div");
  track.className = "track";
  for (const seg of buildSegments(rows, shift)) {
    track.appendChild(buildSegmentEl(seg, shift));
  }
  return track;
}

function buildAxis(shift) {
  const axis = document.createElement("div");
  axis.className = "axis";

  const spacer = document.createElement("div");
  spacer.className = "role-label-spacer";
  axis.appendChild(spacer);

  const ticks = document.createElement("div");
  ticks.className = "axis-ticks";
  axisTicks(shift).forEach((tick, i) => {
    const el = document.createElement("span");
    el.className = "axis-tick";
    // Position by the same 0..720 scale the segments use, so a tick lines
    // up exactly with the segment boundary underneath it.
    el.style.left = `${(i / 4) * 100}%`;
    el.textContent = formatHhmm(tick);
    ticks.appendChild(el);
  });
  axis.appendChild(ticks);
  return axis;
}

function buildShiftBlock(shiftKey, dayBucket) {
  const shift = SHIFTS[shiftKey];
  const block = document.createElement("section");
  block.className = `shift-block shift-${shiftKey}`;

  const head = document.createElement("div");
  head.className = "shift-head";
  const title = document.createElement("span");
  title.className = "shift-title";
  title.textContent = shiftKey;
  const time = document.createElement("span");
  time.className = "shift-time";
  time.textContent = `${formatHhmm(shift.start)}–${formatHhmm(shift.end)}`;
  head.append(title, time);
  block.appendChild(head);

  block.appendChild(buildAxis(shift));

  for (const role of ROLES) {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "role-label";
    label.textContent = role.label;
    row.appendChild(label);

    const rows = dayBucket?.[shiftKey]?.[role.key] ?? [];
    row.appendChild(buildTrack(rows, shift));

    block.appendChild(row);
  }

  const key = document.createElement("div");
  key.className = "shift-key";
  key.hidden = true;
  block.appendChild(key);

  return block;
}

function buildDayBlock(dayInfo, dayBucket) {
  const day = document.createElement("section");
  day.className = "day-block";

  const heading = document.createElement("h2");
  heading.className = "day-heading";
  heading.textContent = dayInfo.label;
  day.appendChild(heading);

  for (const shiftKey of SHIFT_ORDER) {
    day.appendChild(buildShiftBlock(shiftKey, dayBucket));
  }

  return day;
}

// Always renders all seven days from config.js DAYS, in that fixed order —
// this is a weekly template, not tied to any specific calendar week.
export function renderRoster(container, grouped) {
  container.innerHTML = "";
  for (const dayInfo of DAYS) {
    container.appendChild(buildDayBlock(dayInfo, grouped[dayInfo.key]));
  }
}

const NAME_FONT = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
const TIME_FONT = '9px system-ui, -apple-system, "Segoe UI", sans-serif';

let _ctx;
function measure(text, font) {
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  _ctx.font = font;
  return _ctx.measureText(text).width;
}

function addToKey(keyEl, abbrev, fullName) {
  if (!keyEl) return;
  const entries = JSON.parse(keyEl.dataset.entries || "{}");
  if (entries[abbrev] === fullName) return;
  entries[abbrev] = fullName;
  keyEl.dataset.entries = JSON.stringify(entries);
  keyEl.hidden = false;
  keyEl.textContent = Object.entries(entries)
    .map(([a, n]) => `${a} = ${n}`)
    .join("   ·   ");
}

// Measures each rendered segment and steps down a label ladder — widest
// first — until one fits. Re-run after layout changes (resize, print).
export function fitLabels(root = document) {
  root.querySelectorAll(".shift-block").forEach((block) => {
    const keyEl = block.querySelector(".shift-key");
    if (keyEl) {
      keyEl.dataset.entries = "{}";
      keyEl.hidden = true;
      keyEl.textContent = "";
    }

    block.querySelectorAll(".seg[data-name]").forEach((span) => {
      const name = span.dataset.name;
      const avail = span.clientWidth - 8;
      const nameEl = span.querySelector(".seg-name");
      const timeEl = span.querySelector(".seg-time");

      const ladder = [name, firstInitialLastOf(name), lastNameOf(name), initialsOf(name)];
      const chosen = ladder.find((c) => measure(c, NAME_FONT) <= avail);

      if (chosen === undefined) {
        nameEl.textContent = "";
        span.classList.add("seg-swatch");
        addToKey(keyEl, initialsOf(name), name);
      } else {
        nameEl.textContent = chosen;
        span.classList.remove("seg-swatch");
        if (chosen === initialsOf(name) && chosen !== name) {
          addToKey(keyEl, initialsOf(name), name);
        }
      }

      // The time line fits (or hides) independently of the name line.
      if (timeEl) {
        const timeText = timeEl.dataset.time;
        const fits = measure(timeText, TIME_FONT) <= avail;
        timeEl.textContent = fits ? timeText : "";
        timeEl.hidden = !fits;
      }
    });
  });
}
