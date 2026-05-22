# DNS & domain setup (Namecheap + Cloudflare)

Automation and runbooks for [docs/MVP.md](../docs/MVP.md) §1 (Domains & DNS) and §8 (Deployment). Uses **Wrangler** (already authenticated via OAuth) for Workers, Pages, and Email Routing CLI.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Domains | `inboxfornow.com` (brand), `veqla.com` (receive-only) registered at Namecheap |
| Cloudflare | Account `7ed31ecd01f2a97f6083b1c18da66779`; `wrangler whoami` succeeds |
| Namecheap API | Profile → Tools → **Namecheap API Access** — enable API, whitelist your **public** IP |
| Worker | `workers/inboxfornow-api` deployed at least once |

## Secrets — where to put the Namecheap API key

**Never commit secrets.** Copy the template and fill in values locally:

```bash
cp infra/env.example .env    # repo root — `.env` is gitignored
```

| Variable | Where to get it |
|----------|-----------------|
| `NAMECHEAP_API_USER` | Namecheap API page — API User name |
| `NAMECHEAP_API_KEY` | Namecheap API page — API Key (**this is the secret**) |
| `NAMECHEAP_USERNAME` | Usually same as `NAMECHEAP_API_USER`; omit if identical |
| `NAMECHEAP_CLIENT_IP` | Your public IP, **whitelisted** in Namecheap API settings |
| `NAMECHEAP_USE_SANDBOX` | `true` only for sandbox API + sandbox domains |
| `CLOUDFLARE_API_TOKEN` | Required for `infra:email-routing` catch-all (API); [create token](https://dash.cloudflare.com/profile/api-tokens) with Zone DNS Edit, Email Routing Edit, Workers Scripts Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Pre-filled in `infra/env.example` |

Worker-only secrets use Wrangler (not `.env`):

```bash
cd workers/inboxfornow-api
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put ADMIN_BASIC_AUTH   # value: base64("user:pass")
```

## Ordered setup (production)

```bash
# 1) Verify Namecheap API
npm run infra:namecheap:verify

# 2) Add zones in Cloudflare (get assigned nameservers)
npm run infra:cf-add-zones

# 3) Point Namecheap NS → Cloudflare (reads NS from step 2)
npm run infra:namecheap:point-ns
# Or manually: node infra/scripts/namecheap-point-ns.mjs veqla.com ada.ns.cloudflare.com bob.ns.cloudflare.com

# 4) Wait for NS propagation, then verify
npm run infra:verify-dns

# 5) Pages DNS for inboxfornow.com (+ www)
npm run infra:pages-dns

# 6) Deploy worker
npm run infra:deploy-worker

# 7) Email Routing on veqla.com (catch-all → worker)
npm run infra:email-routing

# 8) Re-verify MX
npm run infra:verify-dns
```

Dry-run flags: append `--dry-run` to `infra:cf-add-zones`, `infra:namecheap:point-ns`, `infra:pages-dns`, `infra:email-routing`.

## Manual dashboard steps (cannot be fully scripted)

### Cloudflare

1. **Pages custom domains** — Workers & Pages → `inboxfornow` → Custom domains → add `inboxfornow.com` and `www.inboxfornow.com`.
2. **www → apex redirect** — Rules → Redirect Rules: `www.inboxfornow.com/*` → `https://inboxfornow.com/$1` (301).
3. **Worker custom domain** — Workers → `inboxfornow-api` → Settings → Domains & Routes → add `api.inboxfornow.com` (zone must be active).
4. **Web Analytics** — Enable for the Pages project (MVP §7).
5. **Do not add SPF/DKIM/DMARC on `veqla.com`** — receive-only; outbound auth records are unnecessary (MVP §1).

### Namecheap

1. After `setCustom`, confirm at Domain List → Manage → **Custom DNS** shows Cloudflare nameservers.
2. URL/email forwarding on Namecheap **will not work** with custom NS (expected).

## Email Routing (veqla.com)

`infra:email-routing` enables routing via Wrangler, then uses the Cloudflare API for MX unlock and catch-all → worker (Wrangler’s catch-all CLI only supports `forward`/`drop`).

```bash
npm run infra:email-routing
```

Requires `CLOUDFLARE_API_TOKEN` in repo-root `.env`. Under the hood:

```bash
cd workers/inboxfornow-api
npx wrangler email routing enable veqla.com
node infra/scripts/setup-email-routing.mjs   # PATCH dns unlock + PUT catch_all worker
```

Expected MX (verify with `dig +short MX veqla.com`):

- `route1.mx.cloudflare.net`
- `route2.mx.cloudflare.net`
- `route3.mx.cloudflare.net`

## Backup domains

Pre-launch shortlist: [infra/backup-domain-candidates.md](./backup-domain-candidates.md).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Namecheap `Invalid request IP` | Whitelist `NAMECHEAP_CLIENT_IP` in API settings |
| `No Cloudflare zone` | Run `npm run infra:cf-add-zones` |
| MX missing | NS not propagated yet, or run `infra:email-routing` |
| Email Worker not firing | Catch-all must be `worker` → `inboxfornow-api` (API, not wrangler rules update); redeploy worker |
| Catch-all wrangler error | Use `npm run infra:email-routing` (API); wrangler only supports forward/drop on catch-all |

## npm scripts

Defined in root `package.json`:

- `infra:namecheap:verify` — API + domain ownership check
- `infra:namecheap:point-ns` — Namecheap → Cloudflare nameservers
- `infra:cf-add-zones` — Create Cloudflare zones
- `infra:pages-dns` — CNAME apex/www → Pages
- `infra:email-routing` — Enable routing + catch-all worker
- `infra:verify-dns` — Public DNS smoke check
- `infra:deploy-worker` — Test + `wrangler deploy`
