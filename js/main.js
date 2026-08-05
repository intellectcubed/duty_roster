import { loadRows } from "./dataSource.js";
import { groupRows } from "./roster.js";
import { renderRoster, fitLabels } from "./render.js";

const statusEl = document.getElementById("status");
const rosterEl = document.getElementById("roster");
const printBtn = document.getElementById("print-btn");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("status-error", isError);
}

async function boot() {
  setStatus("Loading roster…");
  try {
    const rows = await loadRows();
    const grouped = groupRows(rows);

    renderRoster(rosterEl, grouped);
    requestAnimationFrame(() => fitLabels(rosterEl));
    setStatus(`Loaded ${rows.length} coverage segment${rows.length === 1 ? "" : "s"}.`);
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load roster: ${err.message}`, true);
  }
}

printBtn?.addEventListener("click", () => window.print());

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => fitLabels(rosterEl), 120);
});

window.addEventListener("beforeprint", () => fitLabels(rosterEl));

boot();
