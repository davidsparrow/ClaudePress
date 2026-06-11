# FreshPress Hosted CMS Instance

One Railway or Fly.io app per agency buyer. Vercel hosts **published client websites only**.

## Required environment

| Variable | Example | Notes |
|----------|---------|-------|
| `HOSTED` | `1` | Enables boot validation |
| `MASTER_KEY` | `openssl rand -hex 32` | Agency owner login |
| `MONGODB_URI` | `mongodb+srv://.../freshpress_acme` | One DB per buyer |
| `APP_URL` | `https://acme-cms.yourdomain.com` | Public CMS URL |
| `DATA_DIR` | `/data` | Mount persistent volume here |
| `FRESHPRESS_DB_NAME` | `freshpress_acme` | Optional if URI includes db name |

Optional BYOK (env or Admin UI):

- `VERCEL_TOKEN`, `VERCEL_TEAM_ID` — publish client sites to buyer Vercel
- `KEY_ENCRYPTION_SECRET` — BYOK vault encryption (defaults to MASTER_KEY)
- `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` — AI fallback if not in Admin UI

## Railway (primary)

1. Connect repo; Railway uses [`railway.toml`](../railway.toml).
2. Add volume mounted at `/data`; set `DATA_DIR=/data`.
3. Set env vars above.
4. Custom domain → set `APP_URL` to match.
5. Verify `GET /api/health` and `/editor`.

## Fly.io (alternative)

```toml
# fly.toml (create in repo root if using Fly)
app = "freshpress-acme"
primary_region = "iad"

[build]
  builder = "heroku/buildpacks:20"

[env]
  HOSTED = "1"
  DATA_DIR = "/data"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true

[[mounts]]
  source = "freshpress_data"
  destination = "/data"
```

Deploy: `fly launch` → set secrets → `fly volumes create freshpress_data --size 1` → `fly deploy`.

## What is NOT on Vercel

The CMS (Express API + editor) runs on Railway/Fly. Vercel receives static publish bundles via the buyer's `VERCEL_TOKEN`.

## Local dev unchanged

Do not set `HOSTED=1` locally. Use `./data` and optional Mongo.
