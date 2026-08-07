// Component 2: renderer. Pure JSON-to-DOM — takes the model built by
// rosterModel.js and draws it. No Supabase, no time math, no grouping;
// nothing here reaches back into dataSource.js or roster.js.
//
// Every day renders as the same fixed-size grid: Day and Night side by
// side as column groups, 12 hour rows each. A person's name repeats in
// every hour row they cover — no merged/spanned cells.

function buildDayTable(day) {
  const [dayShift, nightShift] = day.shifts;
  const totalCols = (dayShift.roles.length + 1) + (nightShift.roles.length + 1);

  const table = document.createElement("table");
  table.className = "day-grid";

  const thead = document.createElement("thead");

  const titleRow = document.createElement("tr");
  const titleTh = document.createElement("th");
  titleTh.className = "day-title";
  titleTh.colSpan = totalCols;
  titleTh.textContent = day.label;
  titleRow.appendChild(titleTh);
  thead.appendChild(titleRow);

  const bandRow = document.createElement("tr");
  const dayBand = document.createElement("th");
  dayBand.className = "shift-band shift-band-day";
  dayBand.colSpan = dayShift.roles.length + 1;
  dayBand.textContent = `Day  ${dayShift.start}–${dayShift.end}`;
  const nightBand = document.createElement("th");
  nightBand.className = "shift-band shift-band-night";
  nightBand.colSpan = nightShift.roles.length + 1;
  nightBand.textContent = `Night  ${nightShift.start}–${nightShift.end}`;
  bandRow.append(dayBand, nightBand);
  thead.appendChild(bandRow);

  const headerRow = document.createElement("tr");
  for (const shift of [dayShift, nightShift]) {
    const timeTh = document.createElement("th");
    timeTh.className = "col-time";
    timeTh.textContent = "Time";
    headerRow.appendChild(timeTh);
    for (const role of shift.roles) {
      const th = document.createElement("th");
      th.textContent = role.label;
      headerRow.appendChild(th);
    }
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  dayShift.hours.forEach((_, i) => {
    const tr = document.createElement("tr");
    for (const shift of [dayShift, nightShift]) {
      const timeTd = document.createElement("td");
      timeTd.className = "col-time";
      timeTd.textContent = shift.hours[i];
      tr.appendChild(timeTd);

      for (const role of shift.roles) {
        const cell = role.cells[i];
        const td = document.createElement("td");
        if (cell.uncovered) td.classList.add("cell-uncovered");
        td.textContent = cell.name ?? "";
        tr.appendChild(td);
      }
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

export function renderRoster(model, container) {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "roster-days";
  for (const day of model.days) {
    grid.appendChild(buildDayTable(day));
  }

  container.appendChild(grid);
}
