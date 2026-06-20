#!/bin/bash
# Deploy Dallas Tee Times to Cloudflare Workers (Pages).
# Usage: bash deploy.sh
#
# Mirrors the LMDW/DDN pattern: build with Next.js, bundle with OpenNext,
# write DEPLOYED_SHA marker (so deploy-if-changed cron can detect source drift),
# then wrangler deploy.

set -e

# Load Cloudflare credentials from the same vault the other sites use.
set -a
source "$HOME/.hermes/credentials/vault.env" 2>/dev/null || true
set +a
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-e6524633c586bc0d6cc23bd2d308c11c}"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN not set. Source ~/.hermes/credentials/vault.env"
  exit 1
fi

# Homebrew node on PATH (matches DDN/LMDW)
export PATH="/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$SCRIPT_DIR/site"

echo "=== Building tee-times ==="
cd "$SITE_DIR"
npm run build

echo "=== Generating OpenNext bundle ==="
npx opennextjs-cloudflare build

# DEPLOYED_SHA marker — see ~/dailydallasnews/deploy.sh for the full rationale.
# Without this, source-only edits ship the same BUILD_ID and deploy-if-changed
# would think "live == local" and skip the deploy.
cd "$SCRIPT_DIR"
if [ -d .git ]; then
  DEPLOYED_SHA=$(git rev-parse HEAD 2>/dev/null || echo "no-git")
  echo -n "$DEPLOYED_SHA" > "$SITE_DIR/.open-next/assets/DEPLOYED_SHA"
  echo "DEPLOYED_SHA: ${DEPLOYED_SHA:0:8}"
fi

echo "=== Deploying to Cloudflare Workers ==="
cd "$SITE_DIR"
npx wrangler deploy || {
  echo "Wrangler deploy failed. Build is intact in .open-next/. Retry when token is healthy."
  exit 1
}

echo ""
echo "✓ Build + deploy complete."
echo "  Worker URL: https://tee-times.philipbernard.workers.dev"