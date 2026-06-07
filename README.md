# PressPal CMS

Client-safe CMS for agency-built sites — ingest, edit, validate, and publish static websites.

## Features

- **Ingest** — Import HTML pages into frozen templates with editable content slots
- **Guardian** — Deterministic validation before any content change is applied
- **Editor** — Inline slot editing with optional AI-assisted proposals
- **Publish** — Immutable static snapshots with optional Vercel deployment
- **Forms** — Per-site contact forms via Resend (BYOK)
- **SEO prompts** — Developer-facing Cursor prompts for React/Next.js SEO work
- **WordPress** — Export as PHP theme ZIP; import from WXR

## Quick start

```bash
cp .env.example .env
# Set MASTER_KEY in .env

npm install
npm run dev          # API on http://localhost:3001
npm run dev:editor   # Editor on http://localhost:5173 (proxies /api)
```

Build for production:

```bash
npm run build
npm start
```

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `3001`) |
| `MASTER_KEY` | Owner authentication key |
| `DATA_DIR` | Filesystem storage root (default `./data`) |
| `MONGODB_URI` | Optional MongoDB adapter |
| `VERCEL_TOKEN` | Optional deploy on publish |
| `APP_URL` | Public URL for editor links and contact forms |

## Packages

- `presspal` — Express API and core logic (root)
- `presspal-editor` — React/Vite dashboard and editor (`/editor`)

## Tests

```bash
npm test
```
