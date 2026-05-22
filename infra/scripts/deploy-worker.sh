#!/usr/bin/env bash
# Deploy API worker and print next steps for custom domain + secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/workers/inboxfornow-api"

echo "Running worker tests…"
npm test

echo ""
echo "Deploying inboxfornow-api…"
npx wrangler deploy

echo ""
echo "Required secrets (if not set):"
echo "  npx wrangler secret put TURNSTILE_SECRET_KEY"
echo "  npx wrangler secret put ADMIN_BASIC_AUTH   # base64(user:pass)"
echo ""
echo "Custom domain api.inboxfornow.com: add in dashboard or wrangler after zone is active."
echo "Email routing: npm run infra:email-routing"
