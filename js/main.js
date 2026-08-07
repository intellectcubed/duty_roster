import { loadRosterModel } from "./rosterModel.js";
import { renderRoster } from "./render.js";

const statusEl = document.getElementById("status");
const rosterEl = document.getElementById("roster");
const printBtn = document.getElementById("print-btn");

let model = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("status-error", isError);
}

async function boot() {
  setStatus("Loading roster…");
  try {
    model = await loadRosterModel();
    renderRoster(model, rosterEl);
    setStatus(`Loaded ${model.days.length} days.`);
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load roster: ${err.message}`, true);
  }
}

// Explicit render-for-print step, not just an implicit @media print
// restyle of whatever's already on screen: re-draw from the same model
// right before printing, so what's printed is guaranteed current.
printBtn?.addEventListener("click", () => {
  if (!model) return;
  renderRoster(model, rosterEl);
  window.print();
});

boot();
