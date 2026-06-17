# Distribution Repos — Dev vs Release

FreshPress uses two GitHub repositories to separate internal development from what buyers receive.

---

## Repository roles

| Repo | Access | Contains |
|------|--------|---------|
| **`freshpress-dev`** (this repo) | Vendor only | Full feature set, WIP branches, wave prompts, vendor registry, internal scripts |
| **`freshpress-release`** | Buyers (read-only) | Tagged releases only; buyer docs; no `data/vendor/` secrets; no internal ref prompts |

---

## What stays in the dev repo only

- `scripts/provision-buyer.ts` and generated `data/vendor/` output
- `ref/prompts/` (internal build prompts)
- `ref/freshpress-hosted-instance—prompt.txt` and similar architecture specs
- Demo instance secrets / `.env.local`
- `data/` directory (all runtime data)

---

## What goes into the release repo

Everything needed to run the CMS:
- All `src/` backend code
- All `editor/src/` frontend code
- `railway.toml`, `package.json`, `tsconfig.json`
- `docs/` buyer-facing docs (BUYER-SETUP, HOSTED-INSTANCE, SELF-HOSTED-AGENCY, PROVISION-BUYER)
- `EULA.md` (must exist before first buyer access)
- `CHANGELOG.md` (buyer-facing change notes per release)

---

## Release workflow

```
1. Merge feature wave to main in freshpress-dev
2. Run: npm test && npm run build
3. Update CHANGELOG.md with buyer-facing notes
4. Commit and tag: git tag v0.x.0
5. Run: ./scripts/promote-release.sh v0.x.0
6. Redeploy hosted buyers: see docs/RELEASE-HOSTED.md
7. Notify source licensees: "Tag v0.x.0 available in freshpress-release"
```

`promote-release.sh` pushes the tagged commit to `freshpress-release`, stripping vendor-internal paths.

---

## Feature lag policy

- **Default:** release repo receives each stable wave 2–4 weeks after dev merges to `main`
- **Hotfixes:** cherry-pick directly to both repos same day
- **No compile-time feature gating** for v1 — release lag alone is sufficient

---

## Setting up the release repo (first time)

See the setup section in `scripts/promote-release.sh`.

The script requires a `RELEASE_REMOTE` env var pointing to the `freshpress-release` GitHub repo SSH URL:

```bash
export RELEASE_REMOTE=git@github.com:yourorg/freshpress-release.git
./scripts/promote-release.sh v0.1.0
```

For the initial push, run with `--init` to force-push the full history (minus excluded paths):

```bash
./scripts/promote-release.sh --init v0.1.0
```

---

## Buyer access

- **Hosted buyers (Level 3):** never need repo access. You redeploy for them.
- **Source licensees (Level 2/5):** added as GitHub **Read** collaborators (or org members) on `freshpress-release`.
  - Invite: Organization → People → Invite → Read role on `freshpress-release`
  - On churn: remove collaborator (they keep existing clone; lose future updates)

---

## CHANGELOG format (buyer-facing)

```markdown
## v0.x.0 — YYYY-MM-DD

### New
- Brief feature description

### Improved
- Enhancement or fix description

### Breaking changes (if any)
- What changed and what to update
```

Keep it brief and user-focused. Internal wave prompts are not included.
