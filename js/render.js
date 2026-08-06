// DOM rendering: one compact section per day/shift (a header line plus a
// plain list of people — name, start, end, and a small role flag), laid
// out in two newspaper-style columns. Modeled on a real squad's printed
// roster. Same markup renders for screen and print.

import { ROLES, SHIFTS, SHIFT_ORDER, DAYS } from "./config.js";
import { buildSegments, hhmmToMin, minToHhmm } from "./roster.js";

// Crew leader and driver get a small flag, like the reference roster's
// "*" (chief) and "d" (driver) prefixes. Plain members get none.
const ROLE_FLAG = {
  crew_leader: "*",
  driver: "d",
  member_1: "",
  member_2: "",
};

function formatHhmm(hhmm) {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

function clockLabelAt(shift, offsetMin) {
  return formatHhmm(minToHhmm(hhmmToMin(shift.start) + offsetMin));
}

function buildPersonRow({ flag, flagTitle, name, start, end, uncovered }) {
  const tr = document.createElement("tr");
  if (uncovered) tr.classList.add("uncovered-row");

  const flagTd = document.createElement("td");
  flagTd.className = "flag-cell";
  flagTd.textContent = flag;
  if (flag) flagTd.title = flagTitle;
  tr.appendChild(flagTd);

  const nameTd = document.createElement("td");
  nameTd.className = "name-cell";
  nameTd.textContent = name;
  tr.appendChild(nameTd);

  const startTd = document.createElement("td");
  startTd.className = "time-cell";
  startTd.textContent = start;
  tr.appendChild(startTd);

  const endTd = document.createElement("td");
  endTd.className = "time-cell";
  endTd.textContent = end;
  tr.appendChild(endTd);

  return tr;
}

function buildShiftSection(dayInfo, shiftKey, dayBucket) {
  const shift = SHIFTS[shiftKey];
  const section = document.createElement("section");
  section.className = `shift-section shift-${shiftKey}`;

  const heading = document.createElement("h3");
  heading.className = "shift-section-title";
  const label = document.createElement("span");
  label.textContent = `${dayInfo.label} — ${shiftKey === "day" ? "Day" : "Night"} Crew`;
  const time = document.createElement("span");
  time.className = "shift-time";
  time.textContent = `${formatHhmm(shift.start)}–${formatHhmm(shift.end)}`;
  heading.append(label, time);
  section.appendChild(heading);

  const table = document.createElement("table");
  table.className = "crew-list";
  const tbody = document.createElement("tbody");

  for (const role of ROLES) {
    const rows = dayBucket?.[shiftKey]?.[role.key] ?? [];
    const built = buildSegments(rows, shift);
    const flag = ROLE_FLAG[role.key];

    for (const seg of built) {
      tbody.appendChild(
        buildPersonRow({
          flag,
          flagTitle: role.label,
          name: seg.uncovered ? "Uncovered" : seg.name,
          start: clockLabelAt(shift, seg.start),
          end: clockLabelAt(shift, seg.end),
          uncovered: seg.uncovered,
        })
      );
    }
  }

  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

// Always renders all seven days from config.js DAYS, in that fixed order —
// this is a weekly template, not tied to any specific calendar week.
export function renderRoster(container, grouped) {
  container.innerHTML = "";

  const columns = document.createElement("div");
  columns.className = "roster-columns";

  for (const dayInfo of DAYS) {
    for (const shiftKey of SHIFT_ORDER) {
      columns.appendChild(buildShiftSection(dayInfo, shiftKey, grouped[dayInfo.key]));
    }
  }

  container.appendChild(columns);
}
