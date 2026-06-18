# FreshPress Demo Instance

The public demo at `demo.freshpress.dev` runs as a **separate** Railway service from buyer instances. Visitors can explore the full admin and social pipeline without signing up.

---

## How it works

- `DEMO_MODE=1` is set on the demo Railway service
- Visitors hit `/editor` and are auto-authenticated as a pre-seeded demo admin — no login screen
- Writes go through the real API so interactions feel genuine
- The database is reset nightly to the seeded state via a scheduled reset

---

## Required env for demo instance

```bash
HOSTED=1
DEMO_MODE=1
MONGODB_URI=mongodb+srv://...
APP_URL=https://demo.freshpress.dev
DATA_DIR=/data
FRESHPRESS_DB_NAME=freshpress_demo
# No MASTER_KEY required (DEMO_MODE bypasses boot validation key check)
# Set DEMO_RESET_KEY for the nightly reset cron request
DEMO_RESET_KEY=<openssl rand -hex 16>
```

Optional: `RESEND_EARLY_ACCESS_NOTIFY=your@email.com` to receive an email for each Early Access lead.

---

## Provisioning steps

1. Create `freshpress_demo` Atlas database (same cluster as buyers is fine)
2. Railway: new service from `freshpress-dev` repo (or release tag)
3. Attach volume → `/data`
4. Set env vars above
5. Custom domain → `demo.freshpress.dev` → update `APP_URL`
6. Run seed: `npx tsx scripts/seed-demo.ts` (requires `MONGODB_URI` in env)
7. Verify: `https://demo.freshpress.dev/api/health`
8. Visit `https://demo.freshpress.dev/editor` — should enter dashboard without login

---

## Nightly reset

The demo database is wiped and re-seeded nightly to prevent accumulation of visitor edits.

**Option A — Railway cron (preferred):**

Add a cron service in your Railway project that runs:
```bash
npx tsx scripts/seed-demo.ts --reset
```
Schedule: `0 4 * * *` (4 AM UTC daily)

Set `MONGODB_URI` and `FRESHPRESS_DB_NAME=freshpress_demo` on the cron service.

**Option B — GitHub Action:**

```yaml
name: Reset demo
on:
  schedule:
    - cron: '0 4 * * *'
jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx tsx scripts/seed-demo.ts --reset
        env:
          MONGODB_URI: ${{ secrets.DEMO_MONGODB_URI }}
          FRESHPRESS_DB_NAME: freshpress_demo
```

**Option C — HTTP trigger (if using the built-in reset endpoint):**

`POST /api/demo/reset` with `Authorization: Bearer {DEMO_RESET_KEY}` — only available when `DEMO_MODE=1`.

---

## Demo UX

What visitors see:
- Full dashboard with one pre-built demo site ("Acme Plumbing")
- Published blog post with social drafts ready for review
- Social pipeline: pending batch → promote to drafts → copy panel
- Blog page with "Generate social drafts" button
- Demo banner: *"Demo — changes reset nightly"* + **Early Access** button

What is blocked in demo mode:
- Bootstrap a new workspace
- Save integrations API keys (read display only)
- Real publish to Vercel (publish button disabled in demo)
- WordPress import
- Delete site

---

## Early Access leads

Leads captured via the demo banner are stored in the `early_access_leads` Mongo collection on the demo database.

Export leads (vendor-only, requires DEMO_RESET_KEY):
```bash
# Or query Mongo directly
db.early_access_leads.find().sort({ capturedAt: -1 })
```

Optional: set `RESEND_EARLY_ACCESS_NOTIFY` + `RESEND_API_KEY` env to get an email per lead.

---

## Rate limiting

When `DEMO_MODE=1`, the following routes are rate-limited via `express-rate-limit`:
- `POST /api/early-access` — 5 requests per IP per hour
- AI routes (humanize, generate social, chat) — 20 requests per IP per hour

This prevents demo abuse without affecting real instances.
