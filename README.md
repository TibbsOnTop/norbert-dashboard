# Norbert — Life OS Dashboard

A small static dashboard that visualizes data from the "Norbert — Life OS" Notion workspace: the latest Big 3 and anchor statuses, a Life Scan trend chart, a Pattern Notes timeline, and the current Quarter Proof.

No build step, no framework, no fabricated data — if a section has nothing yet, it shows an honest empty state.

## How it works

- `index.html` / `css/style.css` / `js/app.js` — the static site, reads `data/data.json`.
- `scripts/sync.mjs` — pulls the **Life Tracker** and **Quarterly Season Set — Archive** Notion databases via the Notion API and rewrites `data/data.json`.
- `.github/workflows/sync.yml` — runs `sync.mjs` on a weekly schedule (Sunday evening) and on demand, commits the result, and pushes. GitHub Pages serves straight from `main`, so a push is all it takes to update the live site.

## Running the sync manually

```bash
export NOTION_TOKEN=secret_xxx   # a Notion internal integration token
npm run sync
```

The integration must be shared with the "Norbert — Life OS" page in Notion (Notion page → `...` menu → Connections → add the integration). Sharing the parent page cascades to its child databases.

## Local preview

```bash
npx serve .
# or: python -m http.server 4173
```

## Automation

The GitHub Actions workflow needs a `NOTION_TOKEN` repository secret. Set it from your own terminal (never paste the token into a chat or commit it):

```bash
gh secret set NOTION_TOKEN --repo <owner>/norbert-dashboard
```

The workflow runs every Monday at 01:00 UTC (Sunday evening US) and can also be triggered manually:

```bash
gh workflow run sync.yml
```
