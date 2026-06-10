# FreshPress Buyer Setup

You received a CMS URL and owner login key from your FreshPress vendor.

## Owner login

1. Open `{APP_URL}/editor`
2. Enter your **Owner** `MASTER_KEY`
3. You are in FreshPress Dashboard (Sites Mode)

## First site

1. **+ Add Site** — name + optional domain
2. **Choose a design theme** — preview and click **Use this theme**
3. **Overview** → ingest a page URL or build pages manually
4. **Blog** → create a keyword pillar + supportive posts
5. **Settings → Email** — add your Resend API key per site
6. **Settings → Access** — set client password; send invite link
7. **Admin → Integrations** — add your Vercel token to publish live sites
8. **Editor** or **Snapshots** → Publish to deploy static HTML to your Vercel

## End client access

Share with your customer:

- URL: `{APP_URL}/editor/?site={siteId}`
- Login: **Client** mode + site ID + password you set

Clients edit content slots only; design stays locked.

## Contact forms

Forms POST to `{APP_URL}/api/public/sites/{siteId}/contact`. Published sites must use your live `APP_URL` in the form embed snippet (Site Settings → Email).

## Support

Your vendor operates the CMS host. You operate published client sites on your Vercel account.
