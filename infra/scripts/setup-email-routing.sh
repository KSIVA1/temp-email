#!/usr/bin/env bash
# Enable Email Routing on veqla.com and set catch-all → inboxfornow-api worker.
# Requires: wrangler logged in, CLOUDFLARE_API_TOKEN in repo-root .env, worker deployed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WRANGLER="npx --prefix \"$ROOT/workers/inboxfornow-api\" wrangler"
CONFIG="$ROOT/infra/config.json"
ROUTING_MJS="$ROOT/infra/scripts/setup-email-routing.mjs"

RECEIVING_DOMAIN="$(node -e "console.log(require('$CONFIG').receivingDomain)")"
WORKER_NAME="$(node -e "console.log(require('$CONFIG').workerName)")"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    echo "→ $*"
    eval "$@"
  fi
}

echo "Email Routing setup for $RECEIVING_DOMAIN → worker $WORKER_NAME"
echo ""

run "$WRANGLER email routing enable $RECEIVING_DOMAIN"

if $DRY_RUN; then
  run "node \"$ROUTING_MJS\" --dry-run"
else
  run "node \"$ROUTING_MJS\""
fi

echo ""
echo "Verify MX:"
echo "  dig +short MX $RECEIVING_DOMAIN"
echo "  npm run infra:verify-dns"
