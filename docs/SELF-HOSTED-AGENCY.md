# Self-Hosted FreshPress CMS (Agency)

Level 2 deployment — **you** operate Railway/Fly; vendor does not host.

## Same codebase as vendor-hosted

Use `HOSTED=1` with the same env contract as [HOSTED-INSTANCE.md](./HOSTED-INSTANCE.md).

## Differences from Level 3 (vendor-hosted)

| Item | Self-hosted (you) | Vendor-hosted |
|------|-------------------|---------------|
| Railway/Fly account | Your account | Vendor account |
| Uptime / `APP_URL` | Your responsibility | Vendor responsibility |
| Updates | You redeploy on release | Vendor rolls out |
| Instance registry | Not used | Vendor registry |

## Steps

1. Fork or clone licensed repo
2. MongoDB Atlas: `freshpress_youragency`
3. Deploy to Railway or Fly per HOSTED-INSTANCE.md
4. Set `VERCEL_TOKEN` (yours) for client site publishes
5. Per-site Resend in dashboard

## Support

You own infrastructure. FreshPress support scope depends on your license tier.
