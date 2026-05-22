# inboxfornow-api

Cloudflare Worker (HTTP + Email + Cron) for InboxForNow.

## Deploy

```bash
npm test
npx wrangler deploy
```

Or from repo root: `npm run infra:deploy-worker`.

## Secrets

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put ADMIN_BASIC_AUTH
```

## Custom domain

`wrangler.toml` declares `api.inboxfornow.com`. The zone must exist on Cloudflare first — see [../../infra/README.md](../../infra/README.md).

## Email Routing

Inbound mail for `veqla.com` is handled via Email Routing catch-all → this worker. Setup: `npm run infra:email-routing` from the repo root.
