# FreshPress Deployment Ecosystem

This document is the single reference for how FreshPress is sold, deployed, and maintained across all buyer types.

---

## The two things FreshPress separates

| Thing | What it is | Platform |
|-------|-----------|---------|
| **CMS** (editor + API) | Always-on dashboard where agency and end clients edit content | Railway or Fly.io (per buyer) |
| **Published websites** | Static HTML deployed for public visitors | Buyer's Vercel account |

Vercel is **not** the CMS host. It only receives published site bundles.

---

## Deployment levels

```
Level 1 — Local dev (vendor/developer)
Level 2 — Self-hosted cloud (technical agency buyer)
Level 3 — Vendor-hosted (non-technical agency buyer)
Level 4 — End client (no deployment, accesses vendor/buyer CMS)
Level 5 — Source license (power users who want full infra control)
```

### Level 1 — Local development

Who: You (vendor) or a developer customizing FreshPress.

```bash
cp .env.example .env   # set MASTER_KEY
npm install
npm run dev            # API on http://localhost:3001
npm run dev:editor     # Editor on http://localhost:5173
```

Not suitable for remote client access. Use a tunnel or deploy Level 2/3 for that.

---

### Level 2 — Self-hosted cloud (agency buyer)

Who: Technical agency that wants to own their infra and deploy from the repo or release zip.

Stack:
- Railway (primary) or Fly.io — Node 20, `npm run build`, `npm start`
- MongoDB Atlas — one database per instance
- Persistent volume mounted at `/data`

Required env:
```
HOSTED=1
MASTER_KEY=<openssl rand -hex 32>
MONGODB_URI=mongodb+srv://...
APP_URL=https://cms.their-agency.com
DATA_DIR=/data
FRESHPRESS_DB_NAME=freshpress_agencyslug
```

Optional BYOK (add in Admin UI or env):
```
VERCEL_TOKEN / VERCEL_TEAM_ID     — publish client sites
ANTHROPIC_API_KEY / OPENROUTER_API_KEY  — AI features
```

Buyer gets repo read access (from `freshpress-release`) or a release zip.

See `docs/SELF-HOSTED-AGENCY.md` for step-by-step.

---

### Level 3 — Vendor-hosted (default for non-technical buyers)

Who: Agency that wants CMS access without managing infrastructure.

You (vendor) provision one Railway/Fly service per buyer. Buyer never touches git or Railway.

Provisioning: `npx tsx scripts/provision-buyer.ts --slug acme --name "Acme Agency"` generates env block + logs to registry.

Full checklist: `docs/PROVISION-BUYER.md`.

Buyer receives:
- CMS URL (e.g. `https://acme-cms.freshpress.dev`)
- `MASTER_KEY` (one-time, delivered securely)
- Link to `docs/BUYER-SETUP.md`

Buyer then adds their own: Vercel token (Admin UI), Resend key (Site Settings → Email), AI keys (Admin → AI Providers).

---

### Level 4 — End client

Who: Small business editing the site their agency built for them.

Access:
- URL: `{APP_URL}/editor/?site={siteId}`
- Login: Client mode + site ID + password (set by agency in Site Settings → Access)

End clients see **Social drafts only** (Wave 10 UX). They can edit captions, copy to clipboard, and mark as posted. They cannot create sites, ingest, or configure anything.

---

### Level 5 — Source license

Who: Technical buyer who wants full source control to customize or fork (within license terms).

Same stack as Level 2. Buyer gets read access to `freshpress-release` repo or a tagged zip. They own uptime.

Restrictions: no redistribution, no resale, no sharing of source with others. See `EULA.md`.

---

## How buyers manage multiple clients

One CMS instance = one agency buyer. **Not multi-tenant SaaS.**

Inside their dashboard, the buyer creates as many sites as they need:
- Each site → own client password + invite link
- Each site → publishes to buyer's Vercel (separate project per domain)
- Contact forms → buyer's Resend per site

You scale by provisioning more instances (one per buyer), not by sharing one app.

---

## Platform roles and costs

| Layer | Platform | Who pays |
|-------|----------|---------|
| CMS app (API + editor) | Railway (primary) or Fly.io | Vendor (Level 3) or buyer (Level 2/5) |
| CMS database | MongoDB Atlas | Same |
| CMS files (snapshots, media) | Railway/Fly volume at `DATA_DIR=/data` | Same |
| Live client websites | Buyer's Vercel | Buyer |
| Email / contact forms | Buyer's Resend (per-site BYOK) | Buyer |
| AI (blog, campaigns, social) | Buyer's OpenRouter or Anthropic | Buyer |

Railway is the primary platform — `railway.toml` is in the repo. Fly.io is a documented alternative; a sample `fly.toml` is in `docs/HOSTED-INSTANCE.md`.

---

## Demo instance

`demo.freshpress.dev` runs a **separate** Railway service (not a buyer instance) with `DEMO_MODE=1`.

- Visitors enter with no login — pre-seeded admin session is issued automatically
- Writes go through normally; database is reset nightly to seed state
- Early Access email capture via banner
- AI routes are rate-limited when `DEMO_MODE=1`

Setup: `docs/DEMO-INSTANCE.md`.

---

## Codebase vs hosted instance — buyer decision guide

| | Hosted (Level 3) | Codebase (Level 2/5) |
|--|-----|-----|
| **Setup** | You provision; buyer gets URL | Buyer deploys from repo/zip |
| **Uptime** | Your responsibility | Their responsibility |
| **Customization** | Config + BYOK only | Full source modification (within license) |
| **Updates** | You redeploy from release tag | Buyer pulls tag from `freshpress-release` |
| **Best for** | Non-technical agencies | Technical agencies or custom branding |

Both paths run **identical code** from the same release tag.

---

## Environment variables reference

| Variable | Required | Notes |
|----------|---------|-------|
| `PORT` | — | Default `3001` |
| `MASTER_KEY` | Hosted | Break-glass admin auth |
| `APP_URL` | Hosted | Public CMS URL |
| `MONGODB_URI` | `HOSTED=1` | MongoDB Atlas |
| `FRESHPRESS_DB_NAME` | Optional | Default `claudepress` |
| `DATA_DIR` | Hosted | `/data` on Railway/Fly volume |
| `HOSTED` | Production | Set to `1` to enable boot validation |
| `DEMO_MODE` | Demo only | Set to `1` on the demo instance |
| `VERCEL_TOKEN` | Optional | Deploy published sites |
| `VERCEL_TEAM_ID` | Optional | Vercel team |
| `KEY_ENCRYPTION_SECRET` | Optional | BYOK vault encryption (defaults to MASTER_KEY) |
| `ANTHROPIC_API_KEY` | Optional | AI fallback (also configurable in Admin UI) |
| `OPENROUTER_API_KEY` | Optional | AI fallback |
