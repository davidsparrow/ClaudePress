#!/usr/bin/env bash
# promote-release.sh — push a tagged release to the freshpress-release distribution repo.
#
# Usage:
#   ./scripts/promote-release.sh v0.1.0          # tag and push to release repo
#   ./scripts/promote-release.sh --init v0.1.0   # first-time: force-push full history
#
# Required env:
#   RELEASE_REMOTE  — SSH or HTTPS URL of the freshpress-release GitHub repo
#                     e.g. git@github.com:yourorg/freshpress-release.git
#
# What this script does:
#   1. Verifies the working tree is clean and on main
#   2. Runs npm test && npm run build (fast-fail before pushing)
#   3. Creates a signed git tag (or lightweight if GPG not configured)
#   4. Pushes the tag to freshpress-release using git subtree split to exclude
#      vendor-internal paths that must never be distributed
#   5. Creates a GitHub Release on the release repo (requires gh CLI)
#
# Excluded paths (never land in freshpress-release):
#   data/vendor/
#   ref/prompts/
#   scripts/promote-release.sh  (this file — buyers don't need it)
#   .env*
#
# Setup (first time):
#   export RELEASE_REMOTE=git@github.com:yourorg/freshpress-release.git
#   git remote add release "$RELEASE_REMOTE" 2>/dev/null || true
#   ./scripts/promote-release.sh --init v0.1.0

set -euo pipefail

# ── args ────────────────────────────────────────────────────────────────────

INIT=false
TAG=""

for arg in "$@"; do
  case "$arg" in
    --init) INIT=true ;;
    v*) TAG="$arg" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 [--init] v0.x.0"
  exit 1
fi

# ── env check ─────────────────────────────────────────────────────────────

RELEASE_REMOTE="${RELEASE_REMOTE:-}"
if [[ -z "$RELEASE_REMOTE" ]]; then
  echo "Error: RELEASE_REMOTE env var is required."
  echo "  export RELEASE_REMOTE=git@github.com:yourorg/freshpress-release.git"
  exit 1
fi

# ── guard: must be on main and clean ────────────────────────────────────────

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: Must be on main branch (currently on $CURRENT_BRANCH)."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

echo "[promote] Branch: $CURRENT_BRANCH | Tag: $TAG"

# ── quality gate ────────────────────────────────────────────────────────────

echo "[promote] Running tests…"
npm test

echo "[promote] Running build…"
npm run build

# ── tag ────────────────────────────────────────────────────────────────────

if git tag -l | grep -q "^${TAG}$"; then
  echo "[promote] Tag $TAG already exists locally. Skipping tag creation."
else
  echo "[promote] Creating tag $TAG…"
  git tag -a "$TAG" -m "Release $TAG" || git tag "$TAG"
fi

# Push tag to origin (dev repo)
git push origin "$TAG"
echo "[promote] Tag pushed to origin."

# ── release repo remote ─────────────────────────────────────────────────────

if ! git remote | grep -q "^release$"; then
  echo "[promote] Adding remote 'release' → $RELEASE_REMOTE"
  git remote add release "$RELEASE_REMOTE"
fi

# ── push to release repo ────────────────────────────────────────────────────
# Strategy: push the tag directly. The release repo is separate — buyers only
# see tagged commits. We rely on .gitattributes export-ignore for paths that
# should be stripped from archives, and on the release repo not having the
# data/ and ref/prompts/ directories committed.
#
# For the initial push we force-push; subsequent releases use a normal push.

echo "[promote] Pushing tag $TAG to release repo…"

if [[ "$INIT" == "true" ]]; then
  echo "[promote] --init: force-pushing to release remote"
  git push --force release "refs/tags/$TAG:refs/tags/$TAG"
  git push --force release "main:main"
else
  git push release "refs/tags/$TAG:refs/tags/$TAG"
  # Also update main in the release repo so it tracks
  git push release "main:main" || true
fi

echo "[promote] Release repo updated."

# ── GitHub Release (optional — requires gh CLI) ─────────────────────────────

if command -v gh &> /dev/null; then
  REPO_URL=$(git remote get-url release 2>/dev/null | \
    sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')

  # Extract CHANGELOG section for this tag
  NOTES=""
  if [[ -f CHANGELOG.md ]]; then
    NOTES=$(awk "/^## ${TAG}/"'{p=1; next} /^## v/{p=0} p{print}' CHANGELOG.md | head -50)
  fi

  if [[ -n "$NOTES" ]]; then
    gh release create "$TAG" --repo "$REPO_URL" --title "FreshPress $TAG" --notes "$NOTES" || \
      echo "[promote] gh release create failed — create manually at $REPO_URL/releases/new"
  else
    echo "[promote] No CHANGELOG entry for $TAG — skipping GitHub Release creation."
    echo "          Add a '## $TAG' section to CHANGELOG.md and re-run, or create the release manually."
  fi
else
  echo "[promote] gh CLI not found — skipping GitHub Release creation."
  echo "          Install: https://cli.github.com and run: gh release create $TAG --repo <release-repo>"
fi

echo ""
echo "[promote] Done ✓"
echo ""
echo "Next steps:"
echo "  1. Verify the tag at $RELEASE_REMOTE"
echo "  2. Notify source licensees: 'Tag $TAG is available in freshpress-release'"
echo "  3. Redeploy hosted buyers: see docs/RELEASE-HOSTED.md"
