# Release Rollout — Hosted Buyer Instances

## Tag release

```bash
git tag v0.2.0
git push origin v0.2.0
```

## Roll out to active instances

1. Open `data/vendor/instance-registry.json` (from `scripts/provision-buyer.ts`)
2. For each entry with `status: active`:
   - Trigger Railway redeploy from tagged commit, or
   - `railway up` from CI with buyer project token
3. Verify `/api/health` on each `APP_URL`

## Churn playbook

- Set registry `status: churned`
- Pause Railway service
- Archive Atlas DB (export first)
- Revoke custom domain

## Backup before rollout

- Atlas automated backups enabled on cluster
- Optional: `GET /api/admin/export` per instance before deploy
