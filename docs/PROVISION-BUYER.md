# Provision a Buyer CMS Instance

Manual checklist (~2 hours first time). Automate in Wave 8 via `scripts/provision-buyer.ts`.

## 1. Atlas database

- Create database `freshpress_{slug}` (e.g. `freshpress_acme`)
- Create DB user with read/write on that database
- Note connection string

## 2. Railway service

- New project from FreshPress repo
- Attach volume → `/data`
- Set env:

```bash
HOSTED=1
MASTER_KEY=<openssl rand -hex 32>
MONGODB_URI=mongodb+srv://...
APP_URL=https://acme-cms.yourdomain.com
DATA_DIR=/data
FRESHPRESS_DB_NAME=freshpress_acme
```

## 3. Domain

- Custom domain on Railway service
- Update `APP_URL` to final HTTPS URL
- Redeploy if needed

## 4. Verify

- [ ] `GET {APP_URL}/api/health` → `{ "status": "ok" }`
- [ ] `{APP_URL}/editor` loads login
- [ ] Owner login with `MASTER_KEY`
- [ ] Create site → design theme → blog pillar → publish (with buyer Vercel token)

## 5. Handoff packet

Send buyer securely:

- CMS URL (`APP_URL`)
- Owner `MASTER_KEY` (one-time delivery)
- Link to [BUYER-SETUP.md](./BUYER-SETUP.md)

## 6. Log instance

Record in registry (spreadsheet OK for Sprint 1):

| Field | Example |
|-------|---------|
| buyerName | Acme Agency |
| slug | acme |
| railwayProjectId | ... |
| domain | acme-cms.yourdomain.com |
| mongoDbName | freshpress_acme |
| status | active |
| provisionedAt | date |
