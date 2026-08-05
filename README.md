# EMS Duty Roster

A website for generating and managing the EMS duty roster. Built with
Next.js (static export) and Supabase, hosted on GitHub Pages.

## Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS), built as a
  static export (`output: "export"`) so it can be served from GitHub Pages.
- **Backend:** [Supabase](https://supabase.com) (Postgres + auth), accessed
  directly from the client via `@supabase/supabase-js`.

## Project structure

```
src/app/            Next.js pages (App Router)
src/components/      Shared UI components
src/lib/supabase/    Supabase client setup
src/types/           TypeScript types (roster domain + generated DB types)
supabase/migrations/ SQL migrations for the Supabase schema
.github/workflows/   CI: build + deploy to GitHub Pages
```

## Local development

1. Copy the env template and fill in your Supabase project's credentials
   (Project Settings > API in the Supabase dashboard):

   ```bash
   cp .env.local.example .env.local
   ```

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000.

## Database

Schema lives in `supabase/migrations/`. Apply it to your Supabase project
with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

After changing the schema, regenerate the TypeScript types:

```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds the static export and publishes it to
GitHub Pages on every push to `main`.

Setup, one time:

1. In the repo, go to **Settings > Pages** and set **Source** to
   "GitHub Actions".
2. Add repo secrets (**Settings > Secrets and variables > Actions**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Push to `main`.

`next.config.ts` sets `basePath`/`assetPrefix` to `/duty_roster` in
production, assuming the GitHub repo is named `duty_roster`. If you name the
repo something else, update `repoName` in `next.config.ts` to match.
