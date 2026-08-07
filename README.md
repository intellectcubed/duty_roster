# EMS Duty Roster

A static, printable web page that shows a recurring weekly EMS shift template
(Monday–Sunday, no dates) as an hour-by-hour grid — Day and Night shifts
side by side, modeled on the squad's own Excel roster template. Read-only:
it renders whatever's in Supabase. Editing the roster is a separate admin
tool (not part of this repo). Prime directive: the whole week fits on one
printed page.

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
css/styles.css           screen styles + @media print (landscape, 2-column)
js/config.js             shift windows, role labels, Supabase URL/key   ← edit point
js/dataSource.js         fetches raw rows (Supabase or CSV fallback)
js/roster.js             time math: buildSegments, grouping (pure, testable)
js/rosterModel.js         data component: composes dataSource.js + roster.js into
                         one JSON model (days -> shifts -> roles -> hourly cells)
js/render.js             renderer component: pure JSON-to-DOM, builds the
                         hour-by-hour day-grid <table>s
js/main.js               bootstrap; Print button explicitly re-renders, then
                         calls window.print()
data/sample-roster.csv   a full week in the schema below, used as fallback
supabase/migrations/     SQL migrations for the Supabase schema
supabase/seed.sql        sample data matching sample-roster.csv
tests/roster.test.mjs    unit tests for the time math (node --test)
```

Data and rendering are deliberately two separate modules: `rosterModel.js`
is the only place that talks to Supabase or does time math; `render.js`
only ever consumes the JSON model it produces.

## Local development

No install needed. Serve the directory with any static file server, e.g.:

```bash
npx serve . -l 8000
```

Open http://localhost:8000.

## Data model

One row per coverage segment: a person covering a role for part (or all) of
a shift. Splits are multiple rows for the same day/shift/role; uncovered
hours are never stored — they're the render-time complement. See the spec
for the full schema and time math.

Supabase table `roster_segments`: `day_of_week, shift, role, member_id,
start_time, end_time`. `member_id` is a FK to `members` (managed by the
separate admin tool, see
[docs/duty_roster_administration.md](docs/duty_roster_administration.md));
this site reads member names via the public `members_public` view.

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
