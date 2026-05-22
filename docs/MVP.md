# InboxForNow — Go-Live Tasks

> Status legend: `- [ ]` not started · `- [x]` ✅ complete

## Context

The codebase at `/Users/sivakogilathota/dev/ideas/temp-email` is a **front-end-only Astro prototype** of InboxForNow.com — the consumer-facing temp-inbox brand defined in [docs/Temp-email-strategy.md](docs/Temp-email-strategy.md). Inbox interactions are entirely mocked via `simulateOne()` in [src/scripts/app.ts:799](src/scripts/app.ts) against a hardcoded `MOCK_MAILS` table. There is **no backend, no DNS, no real email reception, no legal copy, and no analytics**.

This document lists every concrete task required to ship a launch-ready MVP per the strategy doc's §13 P0 requirements. Scope is **MVP only**: real inbox reception via Cloudflare Email Workers, abuse-hardened, legally compliant, deployed, and observable. Browser extension, Developer API, premium tiers, and pSEO content audits beyond the existing 23 platforms are explicitly **out of scope** for Go-Live.

**Decisions baked into this plan (confirmed):**
- Scope: P0 only.
- Cloudflare account exists; Workers/D1/Email Routing not yet provisioned.
- `inboxfornow.com` is owned. **1 receiving domain — `veqla.com`** — is the entire launch pool. Rotation/expansion to a multi-domain pool is deferred to post-launch when blacklist events appear in telemetry.
- No AdSense at launch. Affiliate links **deferred** — ship clean to maximize day-1 trust signal; the existing ad slot in [src/components/Postbox.astro](src/components/Postbox.astro) stays present-but-empty (or is hidden behind a feature flag) until traffic justifies it.
- Analytics: **Cloudflare Web Analytics** (cookieless, no consent banner required).

**Single-domain launch risk:** With only `veqla.com` in rotation, a blacklist event on a major platform (Instagram, Netflix, PayPal) leaves the service with **zero** working receivers until a backup is provisioned. The `domains` table schema, rotation logic, and admin dashboard are still built day-one so a second/third domain can be plugged in with no code changes — see §1 and §10 contingency.

---

## 1. Domains & DNS

- [ ] Confirm `veqla.com` is registered and accessible. It is the **sole** receiving domain for MVP. Naming passes the strategy §9 test — no `temp/trash/burner/disposable` substrings, innocuous-sounding, `.com` TLD.
- [ ] Add both domains (`inboxfornow.com` + `veqla.com`) to the existing Cloudflare account.
- [ ] Point `inboxfornow.com` nameservers to Cloudflare.
- [ ] Point `veqla.com` nameservers to Cloudflare.
- [ ] Enable **Cloudflare Email Routing** on `veqla.com` (MX records auto-provisioned by Cloudflare).
- [ ] On `veqla.com`, configure a **catch-all rule → Worker** (the worker is built in §2).
- [ ] Verify SPF/DKIM/DMARC are **not** configured on `veqla.com` (we are receive-only — no need to authorize outbound, which would invite abuse vectors).
- [ ] Set `inboxfornow.com` DNS for Cloudflare Pages (created in §6).
- [ ] **Pre-stage a backup**: identify (don't yet register) 2 candidate fallback domains so that if `veqla.com` is blacklisted on day 1, a replacement can be in rotation within an hour. Store the shortlist in a private note.

## 2. Backend — Cloudflare Workers & D1

Create a **separate repository** (or `workers/` sibling directory) for the backend. The frontend repo stays static-only.

- [x] Initialize Wrangler project: `npm create cloudflare@latest inboxfornow-api -- --type=hello-world --ts`.
- [x] Provision D1 database via Wrangler: `npx wrangler d1 create inboxfornow`. Save the database ID into `wrangler.toml`.
- [x] Write initial D1 schema migration (`migrations/0001_init.sql`):
  - `inboxes(id TEXT PK, local_part TEXT, domain TEXT, created_at INTEGER, expires_at INTEGER)`
  - `messages(id TEXT PK, inbox_id TEXT FK, from_name TEXT, from_email TEXT, subject TEXT, body_html TEXT, preview TEXT, otp TEXT NULL, received_at INTEGER, expires_at INTEGER)`
  - `domains(name TEXT PK, status TEXT CHECK (status IN ('active','burned','warming')), added_at INTEGER, last_inbound_at INTEGER)`
  - Indexes on `messages(inbox_id, received_at DESC)` and `inboxes(expires_at)` for sweep.
- [x] Seed `domains` table with a single row: `('veqla.com', 'active', now(), null)`. The rotation logic in the cron and the `/admin/domains` UI still query this table normally — adding more domains later is a pure data insert.
- [x] Implement **HTTP Worker** (`src/api.ts`) with these routes:
  - `POST /api/inbox` → generate inbox, return `{ address, expiresAt }`. Cryptographic random local-part (or adjective-animal-number using the existing dictionary), pick a random `active` domain from D1 (today: always `veqla.com`; the random-pick code stays in place so multi-domain rotation works the moment a second row is inserted).
  - `GET /api/inbox/:id/messages?since=<ts>` → list messages, returns sanitized rows.
  - `POST /api/inbox/:id/extend` body `{ seconds: 600 | 3600 | 86400 }` → update `expires_at`, cap at 24h.
  - `DELETE /api/inbox/:id` → burn (immediate delete).
  - `GET /api/domains/active` → list active receiving domains for the client's UI.
- [x] Implement **Email Worker** (`src/email.ts`) bound via `email` event in `wrangler.toml`:
  - Parse raw MIME with [`postal-mime`](https://www.npmjs.com/package/postal-mime) (the lightweight Workers-compatible parser).
  - Look up `inbox_id` by `to` address in D1; reject if absent (return 550) — protects against catch-all spam.
  - **Sanitize HTML** with `isomorphic-dompurify` configured with a strict allowlist: `p, a, b, strong, i, em, br, ul, ol, li, blockquote, span, div, h1-h4, table, tr, td`. Strip `<script>`, `<iframe>`, `<style>`, tracking pixels (`<img>` is stripped at parse, replaced with `[image]` placeholder for the "show images" toggle to re-fetch separately later — but for MVP, strip entirely).
  - **Drop all attachments** (strategy §13: hard requirement for MVP).
  - **Rewrite outbound URLs** through `/r?u=<encoded>` safe-redirector with an interstitial warning page.
  - Detect OTP server-side using the same regex as [src/scripts/app.ts:140](src/scripts/app.ts) (`OTP_KEYWORDS`, `OTP_PATTERN`).
  - Insert into `messages` table with `expires_at = inbox.expires_at`.
  - Update `domains.last_inbound_at` for the receiving domain.
- [x] Implement **Cron Trigger** worker (runs every 5 min):
  - `DELETE FROM messages WHERE expires_at < now()`
  - `DELETE FROM inboxes WHERE expires_at < now()`
  - Flag any domain in `domains` whose `last_inbound_at` is > 24h stale while peers received mail → write `status = 'burned'` for human review. (With only `veqla.com` in the pool there are no peers to compare against; instead emit a warning log if `veqla.com` has zero inbound mail for any 6-hour window during business hours — that's the single-domain burn signal.)
- [x] Configure `wrangler.toml` with environment vars, D1 binding, Email Routing binding, and `[triggers] crons = ["*/5 * * * *"]`.
- [x] Add **rate limiting** on `POST /api/inbox` using Workers' native rate limit binding: 10 generations per IP per hour.
- [x] Add **Cloudflare Turnstile** invisible widget; verify the token server-side on `POST /api/inbox` (skip in dev with a header flag).
- [x] Add CORS allowlist for `https://inboxfornow.com` only.
- [x] Add structured logging (`console.log` JSON) for: inbox-generate, message-received, domain-burned-flag, sanitization-strip-count.
- [ ] Deploy worker: `npx wrangler deploy`. Verify the Email Worker fires on a test send from a Gmail account.

## 3. Frontend Wiring — Replace the Mock

- [x] In [src/scripts/app.ts](src/scripts/app.ts), introduce `API_BASE` const (e.g. `https://api.inboxfornow.com`).
- [x] Add `fetchActiveDomains()` and call from `boot()` to populate `RECEIVING_DOMAINS` from the API — remove the hardcoded array at [src/scripts/app.ts:30](src/scripts/app.ts). For MVP the response is `['veqla.com']`; the client code does not need to know it's a single-element list.
- [x] Replace `generateLocal()` flow in `regenerate()` and `boot()` with a `POST /api/inbox` round-trip; store the returned `inboxId` in state.
- [x] Replace `simulateOne()` boot timeout at [src/scripts/app.ts:1127](src/scripts/app.ts) with a real subscription. **Use polling** for MVP: `setInterval(() => fetch('/api/inbox/'+id+'/messages?since='+lastTs), 3000)`. SSE/WebSocket is Phase 2.
- [x] Wire the `+10m / +1h / +24h` chips to `POST /api/inbox/:id/extend`.
- [x] Wire the "Burn it" button to `DELETE /api/inbox/:id`.
- [x] Wire the reader's per-message Delete button to `DELETE /api/inbox/:id/messages/:mid` (add the API route in §2).
- [x] Remove or gate the `MOCK_MAILS` table and `simulateOne()` behind `if (import.meta.env.DEV)`.
- [x] Mount the Cloudflare Turnstile widget invisibly; pass the token to `POST /api/inbox`.
- [x] Add a "Tap to retry" empty-state when the API call fails — don't fall back silently to the mock.
- [x] Update [src/scripts/pwa.ts](src/scripts/pwa.ts) only if API base needs CSP allowance; otherwise leave alone.

## 4. Security & Abuse Prevention

- [x] Confirm Email Worker drops all attachments (covered in §2, audit before launch).
- [ ] Confirm DOMPurify allowlist is strict (no `style`, `script`, `iframe`, `object`, `embed`, `form`).
- [x] Implement the **`/r?u=...` interstitial redirector page** in Astro: shows the destination URL, a "Continue" button, and a privacy notice. Bots can't follow links, real users see what they're clicking.
- [x] Add a **Content Security Policy** header on the Pages site: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; script-src 'self'; connect-src 'self' api.inboxfornow.com challenges.cloudflare.com`. Configure via [public/_headers](public/_headers) (new file).
- [x] Add `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), camera=(), microphone=()` to `_headers`.
- [ ] Verify the worker rejects inbound mail with attachments larger than 10MB at the Cloudflare Email Routing level (Cloudflare's default limit is 25MB; lower it).
- [ ] Add an internal abuse log: any inbound mail whose `from` matches known phishing domains (Spamhaus list, pulled weekly) is dropped silently.
- [ ] Run a manual XSS test: send an email with `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `<a href="javascript:alert(1)">`, and verify each is neutralized.

## 5. Legal & Compliance

- [x] Create [src/pages/privacy.astro](src/pages/privacy.astro). Must explicitly state: no IP logging, hard-deletion on TTL expiry, no third-party trackers, no email content retention beyond TTL, Cloudflare as a sub-processor. Strategy §12.
- [x] Create [src/pages/terms.astro](src/pages/terms.astro). Must include: receive-only architecture, prohibition on fraud/harassment/illegal use, no warranty, jurisdiction.
- [x] Update homepage footer at [src/pages/index.astro:75](src/pages/index.astro) — replace `<a href="#">Privacy</a>` and `<a href="#">Terms</a>` with real hrefs.
- [x] Update use-case footer at [src/pages/use-case/[slug].astro:68](src/pages/use-case/[slug].astro) the same way.
- [x] Remove or hide the `<a href="#">Developer API</a>`, `<a href="#">Browser extension</a>`, `<a href="#">Status</a>` placeholders from both footers — or point them to "Coming soon" stubs. Dead `#` links hurt trust.
- [x] Add a one-line cookie/storage disclosure in the footer: "We use localStorage to remember your theme. We do not set tracking cookies."

## 6. PWA & SEO Polish

- [x] Run `npm i -D sharp && node scripts/gen-png-icons.mjs` to generate the **PNG icon fallbacks** the [public/manifest.webmanifest:28](public/manifest.webmanifest) references but which don't exist on disk. Verify `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` are produced.
- [x] Generate a `1200x630` **OG image** with the brand mark + tagline. Save to `public/og.png`. Wire into [src/layouts/Layout.astro:25](src/layouts/Layout.astro) as `<meta property="og:image" content="https://inboxfornow.com/og.png" />` and `<meta name="twitter:image">`.
- [x] Add `<link rel="canonical" href={Astro.url.href} />` to [src/layouts/Layout.astro](src/layouts/Layout.astro).
- [x] Add `Organization` + `WebSite` JSON-LD blocks to [src/layouts/Layout.astro](src/layouts/Layout.astro) — currently only the per-page `WebPage` JSON-LD exists ([src/pages/use-case/[slug].astro:29](src/pages/use-case/[slug].astro)).
- [x] Add `SiteNavigationElement` JSON-LD or a small `<nav>` to the homepage so Google sees structured internal links to `/use-case/`.
- [x] Audit the 23 platform pages in [src/data/platforms.ts](src/data/platforms.ts) for thin-content risk: confirm each `whyEmail` / `privacyAngle` / `uniqueTip` is genuinely platform-specific (already looks good for the entries I sampled, but a full read-through is required).
- [ ] Run Lighthouse against the production build — target 95+ on Performance, 100 on SEO/Accessibility/Best Practices. Fix any LCP/CLS regressions before launch.
- [x] Verify the service worker at [public/sw.js](public/sw.js) doesn't cache API responses (it currently only caches same-origin shell; API will be on `api.inboxfornow.com`, a different origin — the early return at sw.js:33 handles this, but confirm).

## 7. Analytics & Monitoring

- [ ] In Cloudflare dashboard, enable **Web Analytics** for the Pages project. Add the auto-injected beacon snippet (or accept the automatic injection on Pages).
- [ ] Create a Cloudflare Workers Analytics Engine dataset for custom events (inbox-generated, message-received, otp-detected, burn-clicked) from the Worker. Optional but cheap.
- [ ] Create a **uptime monitor** (Cloudflare Healthchecks or external like UptimeRobot) hitting `GET /api/health` (add this endpoint in §2 returning 200 if D1 is reachable) every 5 min. Alert email to your account.
- [x] Add a **domain-health dashboard**: a private Worker route `/admin/domains` (basic-auth protected) that lists each receiving domain's `last_inbound_at` and a 24h inbound count. Daily-glance for blacklist detection.

## 8. Deployment

- [ ] Initialize git repo for the frontend: `git init && git add . && git commit -m "Initial commit"`. Push to a new GitHub repo (private).
- [ ] Create a Cloudflare Pages project, connect it to the GitHub repo, build command `npm run build`, output dir `dist`.
- [ ] Add `inboxfornow.com` and `www.inboxfornow.com` as custom domains on the Pages project. Set the `www → apex` 301 redirect at the Cloudflare DNS layer.
- [ ] Deploy the backend repo to Workers (`wrangler deploy`); bind `api.inboxfornow.com` as a custom domain.
- [ ] Verify HTTPS works on all 3 web hostnames: `inboxfornow.com`, `www.inboxfornow.com`, `api.inboxfornow.com`. Verify `veqla.com`'s MX records resolve to Cloudflare's mail-routing IPs (`route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net`) with `dig MX veqla.com`.
- [ ] Create the [public/_headers](public/_headers) file (per §4) and verify Pages serves the CSP correctly using `curl -I https://inboxfornow.com`.

## 9. Pre-Launch QA

- [ ] **End-to-end smoke test from a clean browser**: visit `inboxfornow.com` → confirm address is generated → copy it → send a Gmail to that address → confirm it arrives in the UI within 5 seconds → verify OTP is auto-detected → click Copy code → close tab → verify after timer expiry the inbox is hard-deleted (D1 check via Wrangler).
- [ ] **Test on real iOS Safari and Android Chrome**: PWA install prompt, home-screen icon, standalone mode, theme toggle persistence, copy-button success.
- [x] **Test all 23 use-case pages render**: visit `/use-case/discord/`, `/use-case/paypal/`, etc. Confirm hero, FAQ, related links work.
- [ ] **Test sitemap**: `curl https://inboxfornow.com/sitemap.xml` returns all 24 URLs. Submit to Google Search Console.
- [x] **Test robots.txt**: confirm `/admin/*` is disallowed (update [public/robots.txt](public/robots.txt) to add `Disallow: /admin/` and `Disallow: /r`).
- [ ] **Test against XSS payloads** (per §4 audit) — verify no `<script>` ever executes in the reader.
- [ ] **Test rate limit**: hit `POST /api/inbox` 11× from one IP; the 11th should 429.
- [ ] **Test Turnstile**: confirm a curl without a token fails; a browser request with a valid token succeeds.
- [ ] **Test all toolbar controls on a use-case page** (the [slug].astro page is missing the `#year` script that the homepage has at index.astro:463 — confirm the footer year renders correctly; if broken, add the script).
- [ ] **Test the onboarding tour**: first visit → tour fires; second visit → silent; "Replay tour" link works.

## 10. Go-Live Day & Day-1 Operations

- [ ] Submit `https://inboxfornow.com/sitemap.xml` to **Google Search Console** and **Bing Webmaster Tools**.
- [ ] Verify Cloudflare Web Analytics is recording sessions.
- [ ] Post a "we just launched" comment on r/SaaS, r/SideProject, r/InternetIsBeautiful (per strategy §11 Phase 1). Do **not** post to r/privacy or r/degoogle until you've had a week of clean operation.
- [ ] Watch the domain-health dashboard for the first 48 hours. **Single-domain contingency**: if `veqla.com` shows zero inbound mail for any 6-hour business-hours window or returns sender bounces, immediately (a) register one of the pre-staged fallback domains from §1, (b) add it to Cloudflare Email Routing with the catch-all → Worker rule, (c) `INSERT INTO domains` with `status='active'`, (d) `UPDATE domains SET status='burned' WHERE name='veqla.com'`. Total turnaround target: under 60 minutes.
- [ ] Have a written rollback plan: if the Email Worker breaks, revert via `wrangler rollback`. If the frontend breaks, revert the Pages deployment via the dashboard.
- [ ] Tag a `v1.0.0` git release on both repos.

---

## Verification

The launch is verified when:
1. A first-time visitor lands at `inboxfornow.com`, gets an address, sends themselves a verification email from a real third-party signup (e.g. trying to register on a test forum), receives the code in the UI within 10 seconds, and copies it — **without any console errors, without any Mixed Content warnings, and without seeing any mocked content**.
2. The Cloudflare dashboard shows non-zero Email Routing events, non-zero Worker invocations, non-zero D1 reads/writes, and non-zero Web Analytics page views.
3. `curl -I https://inboxfornow.com` returns all the security headers from §4.
4. Lighthouse on the production homepage and one use-case page both score 95+ Performance and 100 SEO.
5. Google Search Console acknowledges the sitemap and shows zero indexing errors after 24 hours.

## Out of Scope (Explicit)

Documented so we don't scope-creep:
- Browser extension (Phase 2, strategy §13)
- Developer API with billing (Phase 3)
- Custom usernames / aliases (Phase 2)
- Multiple expiration windows beyond the existing 10m/1h/24h chips (already in UI — no change)
- Affiliate links / programmatic ads (deferred per launch decision)
- Domain health UI on consumer pages (internal admin dashboard only at launch)
- SSE / WebSocket realtime (polling at 3s is sufficient for MVP)
- Mobile native apps
- The 200+ additional pSEO pages — 23 is fine to launch; expand post-validation.
