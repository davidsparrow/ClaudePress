# PressPal CMS

Client-safe CMS for agency-built sites — ingest, edit, validate, and publish static websites.

> **Product direction:** Rebranding to **FreshPress CMS**. Deployment architecture below uses FreshPress naming for the target stack; package names may still read `presspal` until the rebrand phase lands.

## Features

- **Ingest** — Import HTML pages into frozen templates with editable content slots
- **Guardian** — Deterministic validation before any content change is applied
- **Editor** — Inline slot editing with optional AI-assisted proposals
- **Publish** — Immutable static snapshots with optional Vercel deployment
- **Forms** — Per-site contact forms via Resend (BYOK)
- **SEO prompts** — Developer-facing Cursor prompts for React/Next.js SEO work
- **WordPress** — Export as PHP theme ZIP; import from WXR

## Roles

| Role | Who | Login | Purpose |
|------|-----|-------|---------|
| **Vendor** | You (FreshPress seller) | — | Ship updates; optionally host CMS for buyers |
| **Agency owner** | Your buyer | Owner + `MASTER_KEY` | Build sites, settings, client passwords, invites |
| **End client** | Buyer’s customer | Client + site ID + site password | Edit content slots for one site; design stays locked |

End clients use `{APP_URL}/editor/?site={siteId}`. The CMS must be **always-on at a public URL** — a laptop-only install does not work for remote client editing.

## Deployment by user level

FreshPress splits **where you edit** (CMS) from **what visitors see** (published static sites).

```text
┌─────────────────────────────────────────────────────────────────┐
│  CMS host (Railway or Fly)                                       │
│  API + /editor  ·  MongoDB  ·  volume for snapshots/media       │
│  Agency owner + end clients log in here                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ publish (VERCEL_TOKEN)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Buyer’s Vercel — live client websites (static HTML)             │
│  Public visitors; pages stay up if CMS is briefly down           │
└────────────────────────────┬────────────────────────────────────┘
                             │ contact form POST
                             ▼
                      CMS API (APP_URL) → Resend (buyer BYOK)
```

| Layer | Platform | Holds |
|-------|----------|--------|
| CMS app | **Railway** or **Fly.io** | Editor, API, auth, form handler |
| CMS data | **MongoDB Atlas** | Sites, pages, versions, passwords, form inbox, email config |
| CMS files | **Volume** on Railway/Fly (`DATA_DIR`) | Publish bundles, WordPress media (until object storage) |
| Live sites | **Buyer’s Vercel** | Static HTML for end-customer domains |
| Email | **Buyer’s Resend** | Per-site API keys (BYOK) |

**Vercel is not the CMS host** — it is the publish target for client websites. Railway/Fly fits the current Express app, disk snapshots, and long imports better than serverless.

---

### Level 1 — Local development (vendor or agency developer)

**Who:** Building or customizing FreshPress on a machine.

**Setup:**

```bash
cp .env.example .env
# Set MASTER_KEY in .env

npm install
npm run dev          # API on http://localhost:3001
npm run dev:editor   # Editor on http://localhost:5173 (proxies /api)
```

| Item | Value |
|------|--------|
| Storage | `./data` (filesystem) or optional `MONGODB_URI` |
| `APP_URL` | `http://localhost:3001` |
| Client editing | Same machine only unless you tunnel a public URL |
| Live sites | Optional `VERCEL_TOKEN` to deploy test publishes |

**Not for production client access.**

---

### Level 2 — Self-hosted cloud CMS (technical agency buyer)

**Who:** Agency runs their own always-on CMS so staff and **end clients** can edit from anywhere.

**Stack:** Railway or Fly + MongoDB Atlas + volume + buyer’s Vercel for published sites.

| Step | Action |
|------|--------|
| 1 | Create MongoDB Atlas database (e.g. `freshpress_agencyname`) |
| 2 | Deploy repo to **Railway** or **Fly.io** (Node 20, `npm run build`, `npm start`) |
| 3 | Mount persistent volume → set `DATA_DIR=/data` |
| 4 | Set env: `HOSTED=1`, `MASTER_KEY`, `MONGODB_URI`, `APP_URL=https://cms.agency.com` |
| 5 | Set `VERCEL_TOKEN` (agency’s) for publish-to-client-sites |
| 6 | Owner logs in → create site → set client password → send invite |

**Handoff to end client:** `{APP_URL}/editor/?site={siteId}` + site password (see Site Settings → Access).

Detailed steps: `docs/HOSTED-INSTANCE.md` and `docs/BUYER-SETUP.md` (added in hosted sprint).

---

### Level 3 — Vendor-hosted CMS (default for non-technical buyers)

**Who:** You operate one Railway/Fly app **per agency buyer**. Buyer never installs anything.

| You provision | Buyer receives |
|---------------|----------------|
| Railway/Fly service + volume | CMS URL |
| Atlas DB `freshpress_{slug}` | Owner `MASTER_KEY` |
| Custom domain on `APP_URL` | Onboarding doc |

Buyer adds **their** keys: Resend (per site in dashboard), Vercel token (env or Admin UI), optional AI keys.

Provisioning playbook: `docs/PROVISION-BUYER.md` (added in hosted sprint).

---

### Level 4 — End client (no deployment)

**Who:** Small business editing the site the agency built for them.

| Need | Provided by agency |
|------|-------------------|
| Editor URL | `{APP_URL}/editor/?site={siteId}` |
| Login | Client mode + site ID + password |
| Hosting | Nothing — uses agency’s CMS URL |

Clients do not deploy FreshPress. Published **visitor-facing** site lives on the agency’s Vercel project.

---

### Level 5 — Source license / clone (power users)

**Who:** Buyer wants full source control on their own infra.

- Private repo access or release zip + proprietary license
- Same stack as Level 2 (cloud server recommended; not a laptop)
- You do not host; buyer owns uptime and `APP_URL`

See `ref/FreshPress Licensing & Distribution .txt` and `COMMERCIAL-LICENSE.md` (planned).

---

## Quick start (local)

```bash
cp .env.example .env
# Set MASTER_KEY in .env

npm install
npm run dev
npm run dev:editor
```

Production build (same process Railway/Fly runs):

```bash
npm run build
npm start
# Serves API + editor at /editor from editor/dist
```

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `3001`) |
| `MASTER_KEY` | Agency owner authentication key |
| `APP_URL` | Public CMS URL — editor invites, contact form API |
| `DATA_DIR` | Storage root (default `./data`; use `/data` on Railway/Fly volume) |
| `MONGODB_URI` | MongoDB Atlas — **required** for hosted (`HOSTED=1`) |
| `HOSTED` | Set to `1` on Railway/Fly production CMS instances |
| `VERCEL_TOKEN` | Deploy published client sites to buyer’s Vercel |
| `VERCEL_TEAM_ID` | Optional Vercel team |

Per-site Resend keys are configured in the dashboard (Site Settings → Email), not only in env.

## Packages

- `presspal` — Express API and core logic (root; → `freshpress` after rebrand)
- `presspal-editor` — React/Vite dashboard and editor (`/editor`)

## Implementation prompts

- Dashboard architecture: `docs/presspal-dashboard-architecture.md`
- Rebrand + hosted CMS (Railway/Fly): `ref/freshpress-hosted-instance—prompt.txt`

## Tests

```bash
npm test
```
