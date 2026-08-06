// The ONLY module that fetches roster data. Returns normalized rows:
// { day, shift, role, member, start, end }
//
// This is a recurring weekly template (Monday..Sunday), not a roster tied
// to calendar dates — day ordering is applied client-side from
// config.js DAYS, not from the fetch/CSV order.
//
// Prefers Supabase (js/config.js SUPABASE_URL); falls back to the bundled
// sample CSV when unconfigured, so the page always has something to render.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_TABLE } from "./config.js";

const MEMBERS_VIEW = "members_public";

function supabaseHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };
}

async function fetchSupabase(path, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, { headers: supabaseHeaders() });
  if (!response.ok) {
    throw new Error(`Supabase request failed (${path}): ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// roster_segments.member_id -> members_public is joined client-side with a
// second fetch rather than a PostgREST embed, since embedding through a
// view (members_public exists so the anon key never sees phone numbers)
// isn't guaranteed to be picked up the same way a direct table FK is.
async function loadFromSupabase() {
  const [segments, members] = await Promise.all([
    fetchSupabase(SUPABASE_TABLE, {
      select: "day_of_week,shift,role,member_id,start_time,end_time",
    }),
    fetchSupabase(MEMBERS_VIEW, { select: "id,first_name,last_name" }),
  ]);

  const nameById = new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`]));

  return segments.map((row) => ({
    day: row.day_of_week,
    shift: row.shift,
    role: row.role,
    member: nameById.get(row.member_id) ?? "Unknown",
    start: row.start_time,
    end: row.end_time,
  }));
}

function normalizeCsvRow(row) {
  return {
    day: row.day,
    shift: row.shift,
    role: row.role,
    member: row.member,
    start: row.start,
    end: row.end,
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    header.forEach((key, i) => (row[key] = cells[i]));
    return normalizeCsvRow(row);
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
