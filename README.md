# EMS Duty Roster

A static, printable web page that shows a week of EMS shifts as colored bars
on a shared time axis. Read-only: it renders whatever's in Supabase. Editing
the roster is a separate admin tool (not part of this repo).

Full design spec: [docs/duty_roster_BUILD_SPEC.md](docs/duty_roster_BUILD_SPEC.md).

## Stack

- **Frontend:** plain HTML/CSS/ES-modules. No build step, no framework,
  no npm dependency — served directly by GitHub Pages.
- **Backend:** [Supabase](https://supabase.com) Postgres, read via the REST
  API with the public/publishable key (respects row-level security). Falls
  back to `data/sample-roster.csv` when Supabase isn't configured.

## Project structure

```
index.html              entry page + toolbar (Print button, status)
css/styles.css           screen styles + @media print (landscape)
js/config.js             shift windows, roles, Supabase URL/key   ← edit point
js/dataSource.js         the ONLY module that fetches data
js/roster.js             time math, buildSegments, grouping (pure, testable)
js/render.js             DOM bars + fitLabels (adaptive labels)
js/main.js               bootstrap, print, resize/beforeprint reflow
data/sample-roster.csv   a full week in the schema below, used as fallback
supabase/migrations/     SQL migrations for the Supabase schema
supabase/seed.sql        sample data matching sample-roster.csv
tests/roster.test.mjs    unit tests for the time math (node --test)
```

## Local development

No install needed. Serve the directory with any static file server, e.g.:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

## Data model

One row per coverage segment: a person covering a role for part (or all) of
a shift. Splits are multiple rows for the same date/shift/role; uncovered
hours are never stored — they're the render-time complement. See the spec
for the full schema and time math.

Supabase table `roster_segments`: `duty_date, shift, role, member,
start_time, end_time`.

## Database

Schema and sample data live in `supabase/`. Apply with the
[Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push --linked
npx supabase db query --linked --file supabase/seed.sql
```

`js/config.js` holds the Supabase URL and publishable key — safe to commit,
since it's a public/anon-scoped key gated by the read-only RLS policy.

## Deployment (GitHub Pages)

No build step, so no GitHub Actions workflow is needed. In the repo, go to
**Settings > Pages**, set **Source** to "Deploy from a branch", and pick
`main` / `/ (root)`.

## Tests

```bash
node --test tests/
```
