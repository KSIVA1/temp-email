#!/usr/bin/env bash
# Set the Cloudflare secrets required by GitHub Actions workflows.
# Run this after creating the remote repo.
# Requires: gh auth login, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID available.
set -euo pipefail

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo>"
  echo "Example: $0 KSIVA1/temp-email"
  exit 1
fi

ACCOUNT_ID="7ed31ecd01f2a97f6083b1c18da66779"

echo "Setting secrets on $REPO"
echo ""

read -rsp "Cloudflare API Token: " CF_TOKEN
echo ""

echo "→ CLOUDFLARE_API_TOKEN"
gh secret set CLOUDFLARE_API_TOKEN --body "$CF_TOKEN" --repo "$REPO"

echo "→ CLOUDFLARE_ACCOUNT_ID"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$ACCOUNT_ID" --repo "$REPO"

echo ""
echo "Done. Verify with: gh secret list --repo $REPO"
