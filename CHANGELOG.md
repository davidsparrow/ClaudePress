# Changelog

All buyer-facing changes are documented here. Format: `## v0.x.0 — YYYY-MM-DD`.

---

## v0.10.0 — 2026-06-11

### New
- **Social Content Pipeline** — AI-generated social drafts (LinkedIn, X, Instagram, Facebook) from published blog posts. Pending batches for admin review; drafts tab for copy-paste and mark-as-posted. Client users see Drafts only.
- **Admin User Profiles** — Email + password login for agency staff. Workspace bootstrap via MASTER_KEY. Session management (30-day tokens).
- **Demo Mode** — `DEMO_MODE=1` env enables credential-free public demo with Early Access email capture and nightly database reset.
- **Seed Data** — `scripts/seed-demo.ts` populates workspace, site, blog, and social drafts for demo and buyer onboarding.

### Improved
- `docs/BUYER-SETUP.md` updated with onboarding sample site walkthrough.
- `docs/DEPLOYMENT-ECOSYSTEM.md` — full platform and tier reference.
- `EULA.md` — proprietary license placeholder (attorney review required before first sale).

---

## v0.9.0 — 2026-05-XX

*(Previous internal waves — Wave 1 through 9 — see internal release notes.)*
