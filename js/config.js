// Single edit point for deployment-specific values.

export const SHIFTS = {
  day: { key: "day", start: "0600", end: "1800" },
  night: { key: "night", start: "1800", end: "0600" },
};

export const SHIFT_ORDER = ["day", "night"];

export const ROLES = [
  { key: "crew_leader", label: "Crew ldr" },
  { key: "driver", label: "Driver" },
  { key: "member_1", label: "Member 1" },
  { key: "member_2", label: "Member 2" },
];

// Public (publishable) Supabase project credentials — safe to commit, this
// key only grants what the `roster_segments` read policy allows.
// Leave supabaseUrl empty to fall back to data/sample-roster.csv.
export const SUPABASE_URL = "https://mtgfndxbxtbmwmrjbmil.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3z4x_vB8T9sZ2GGeXctKTg_8ZKFWSWk";

export const SUPABASE_TABLE = "roster_segments";
