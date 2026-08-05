// The ONLY module that fetches roster data. Returns normalized rows:
// { date, shift, role, member, start, end }
//
// Prefers Supabase (js/config.js SUPABASE_URL); falls back to the bundled
// sample CSV when unconfigured, so the page always has something to render.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_TABLE } from "./config.js";

function normalize(row) {
  return {
    date: row.date ?? row.duty_date,
    shift: row.shift,
    role: row.role,
    member: row.member,
    start: row.start ?? row.start_time,
    end: row.end ?? row.end_time,
  };
}

async function loadFromSupabase() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  url.searchParams.set("select", "duty_date,shift,role,member,start_time,end_time");
  url.searchParams.set("order", "duty_date.asc");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${response.statusText}`);
  }

  const rows = await response.json();
  return rows.map(normalize);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    header.forEach((key, i) => (row[key] = cells[i]));
    return normalize(row);
  });
}

async function loadFromSampleCsv() {
  const response = await fetch(new URL("../data/sample-roster.csv", import.meta.url));
  if (!response.ok) {
    throw new Error(`Failed to load sample CSV: ${response.status}`);
  }
  return parseCsv(await response.text());
}

export async function loadRows() {
  if (SUPABASE_URL) {
    return loadFromSupabase();
  }
  return loadFromSampleCsv();
}
