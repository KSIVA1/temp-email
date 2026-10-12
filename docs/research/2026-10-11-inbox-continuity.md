# Inbox continuity and honest loading states — October 11, 2026

This pass advances the product-usefulness priority in the SEO worklog. It does not establish a ranking increase. The prior goal turn made concrete progress: it published the new guides and loading dependency changes, expanded health checks and updated the daily automation.

## Reproduced problems

A production browser reload changed an active address from `bass24753@veqla.com` to `vole62382@veqla.com`. Original DOM observations are preserved in `.seo-cache/research/2026-10-11/before-reload.md` and `after-reload.md`. The app unconditionally created an inbox on page load. Visiting its guides and returning therefore also lost the mailbox selection.

The source also displayed the static `fox9821` address before creation and generated a local random address in the API-error path. Neither was tied to an API-created mailbox, while Copy remained available. This was a functional problem for users requesting real messages, not evidence of a specific Google ranking factor or penalty.

## Change

The active inbox identifier is retained in sessionStorage for the current tab and revalidated with the existing read-only mailbox endpoint after reload or navigation. The server's expiry remains authoritative. A confirmed 404 permits a fresh inbox; network errors, rate limits and server failures preserve the selected identifier for retry. New address deliberately replaces it only after creation succeeds. No message body is saved to browser storage, and the identifier is not added to the page URL.

Loading and failed creation no longer display a made-up email address or a running mailbox timer. Copy, QR, expiry extensions and deletion stay disabled until an actual active mailbox is available. An unavailable browser store falls back to in-memory use and the UI explains that reload retention is unavailable.

Expiry clears visible messages and disables the old address. Polling ignores responses from an inbox that has been replaced, so a delayed old response cannot populate a new mailbox. The frontend no longer requests the domain list before creation because the API already selects its active receiving domain.

The homepage FAQ, product guides, About page and privacy description now describe the actual tab-retention behavior. Sitemap dates were updated for privacy and the existing platform pages that embed the changed tool. The platform directory and Terms date were not advanced. Browser session restore may retain tab storage; no promise of secure erasure on tab closure is made.

## Validation

- Build passed: 33 HTML pages. SEO checks passed: 31 sitemap URLs, 488 internal links, existing canonical/indexing/schema checks and goal boundary checks.
- `npm run test:inbox` passed all 13 session tests: restoration and original deadlines, authoritative extensions, confirmed expiry/deletion, network/429/500/503 failures, failed replacement, concurrent connection attempts, malformed storage, invalid responses, forgetting the correct identifier, and blocked storage.
- Strict TypeScript checks passed for `app.ts` and `inbox-session.ts` using the project config.
- A localhost-only synthetic API deliberately delayed and failed requests. Browser checks verified disabled Copy and no receiving address after HTTP 503; Retry recovery; same address and decreasing timer on reload; no new creation on a failed restore/retry; failed New address preserving the old inbox; deliberate replacement; an hour extension retained after guide navigation; expiry clearing the list; and isolation from a delayed prior mailbox response.
- Original failure, expiry and response-race DOM evidence is in `.seo-cache/research/2026-10-11/`. The API fixture is `scripts/fixtures/inbox-api.mjs`, binds only to 127.0.0.1 and sends no SMTP messages. Both local servers were stopped. A production build restored the real API base; the fixture endpoint was checked absent from the JavaScript output.

Published as Cloudflare Pages deployment **920e21c8.inboxfornow.pages.dev**, serving inboxfornow.com. The live browser retained `ibis51740@veqla.com` across reload and guide navigation, with its timer decreasing from 09:49 to 09:34 rather than resetting. The browser reported no console warnings or errors. Original DOM and screenshot proof: `.seo-cache/research/2026-10-11/live-inbox-continuity.*`.

Post-deployment snapshot `.seo-cache/daily/2026-10-11/snapshot-105908.json` passed all 31 sitemap pages, robots access, 10 declared local assets and both service probes. GSC remains unavailable with the same RefreshError. The ranking validator remains false against today's original Google observations. No API schema, mailbox lifetime limit, receiving rule, or access permission was expanded. SEO rankings and GSC measurement gaps remain separate from these functional checks.
