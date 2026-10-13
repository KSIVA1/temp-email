# InboxForNow daily SEO monitoring

The default market is Google US, English, desktop. Primary searches are `temporary email`, `temp mail`, and `disposable email`; secondary searches appear in [seo-targets.json](seo-targets.json). These are assumptions from the user's request, not a claim of measured search volume. Change the config if the user specifies a different market or keyword set.

Daily at 9:00 AM America/Chicago, the chat heartbeat runs the checks below. It should stay quiet while evidence is unchanged or non-actionable, and report meaningful changes, completed fixes, failures, required user action, or verified achievement. Don't rewrite content every day merely to appear fresh.

## Crawl and Search Console

Run `npm run seo:monitor`. This checks every sitemap URL for HTTP 200, one H1, a matching canonical, no accidental noindex, no redirects, Googlebot access in robots.txt, the declared local stylesheet/script/preload assets, and a genuine 404 for a missing URL. Read-only health and domain endpoints check API availability. Each active receiving domain also gets a public MX lookup through Cloudflare's documented DNS-over-HTTPS JSON endpoint. Expected MX hosts come from `infra/config.json`; the snapshot retains observed hosts, priorities and TTLs. Missing or changed records are configuration findings. Reduced redundancy is not proof of total outage, and a resolver error is an unavailable measurement rather than a receiving failure. These checks do not establish successful SMTP delivery or verify the provider's catch-all rule. The script writes time-stamped snapshots under `.seo-cache/daily/YYYY-MM-DD/`; reruns preserve earlier evidence.

After changing DNS monitoring, run the offline classification checks with `.seo-cache/venv/bin/python scripts/seo-monitor.test.py`. They cover correct records, a changed provider, reduced redundancy, null MX, NODATA/NXDOMAIN, malformed/truncated answers, resolver failures and invalid names. The daily monitor reads no mailbox contents and uses no provider credentials for these public DNS checks. The one-time October 11 routing audit found the expected public DNS records, but the existing Cloudflare token could not read routing settings/catch-all rules (HTTP 403). Do not infer that the rule is broken or request broader permissions merely to repeat this audit.

The Search Console component uses the existing domain property `sc-domain:inboxfornow.com`, read-only access, exact query filters, US desktop web search, fully processed data, comparable 7-day/28-day windows and the previous 28 days. It also inspects indexing for the home, Discord, GitHub and ChatGPT pages and reads the sitemap status. Query tables can omit anonymized searches. No returned row is missing data, not a zero ranking. Google reports average positions, not a live localized rank.

On October 9, 2026, Google's saved OAuth authorization returned `invalid_grant`. Dependencies are already installed in `.seo-cache/venv`. To restore the existing read-only access, run:

```sh
npm run seo:authorize
```

Complete the Google account authorization in the opened browser yourself. This uses the saved OAuth client at `~/.claude/skills/seo/.secrets/credentials.json` and replaces the expired token at `~/.claude/skills/seo/.secrets/gsc-token.json`. Credentials stay outside Git and are never printed. Alternative paths can be supplied using `GSC_CLIENT_PATH` and `GSC_TOKEN_PATH`.

If setting up a new checkout, install the Python runtime dependencies first:

```sh
python3 -m venv .seo-cache/venv
.seo-cache/venv/bin/pip install -r scripts/seo-requirements.txt
```

Expired authorization is a known measurement gap. Report the necessary user action once, continue crawl and browser checks, and do not treat the old June cache as current data. Do not repeatedly run interactive authorization during scheduled checks.

### Existing browser session fallback, verified October 12

The API token remains expired, but the user's existing signed-in Chrome session can read the `sc-domain:inboxfornow.com` Search Console property. When that authorized session is available through supported browser tools, use its read-only reports as a supplement. Do not start a fresh login, OAuth grant, account switch to an unverified owner, or permission change unattended. If unavailable, retain the API gap and continue independent work. Keep this authenticated data work separate from signed-out localized ranking checks.

Save original report DOM/screenshots in the ignored evidence cache and write a separate dated `gsc-browser.json`; do not overwrite an API failure snapshot as though OAuth had recovered. Record filters, actual chart dates and last-update dates. October 12's page-indexing summary was dated October 8; it predates the fixes. URL Inspection independently confirmed a successful October 12 homepage crawl and matching Google-selected canonical. Missing query rows and incomplete link reports are not proof of zero impressions or zero backlinks. Keep private analytics and query exports out of the public Git repository.

The updated 31-URL sitemap was submitted once October 12 after the report showed its last read on October 6 with 27 URLs. On October 13, the browser report confirmed a successful October 12 read with all 31 pages discovered. Both original guides requested once October 12 are now confirmed indexed with successful October 12 crawls and matching canonicals. Before any URL indexing request, check the dated worklog and saved evidence. Requests do not guarantee indexing, and repetition does not improve queue priority. Do not repeat those requests or resubmit unchanged content daily.

## Exact ranking evidence

Use the supported browser tool to check each primary query with `https://www.google.com/search?q=<query>&gl=us&hl=en&pws=0`, signed out, at a desktop viewport. Inspect the visible Google location footer. Record the actual locality; the first run showed **Phillips Creek Ranch, Frisco, TX, from the IP address**. The US parameter alone does not prove the IP's country. Results are an observation from that locality and device, not a universal US ranking.

Save the original DOM snapshot and screenshot for every query before navigating away. Do not use a general web search tool's ordering as a Google position, count AI Overview citations as organic results, click competitors to influence metrics, or programmatically scrape Google at scale. Inspect the organic result order explicitly, excluding ads, carousels, AI panels, and secondary sitelinks. Follow visible links only when needed to establish the destination of an opaque Google redirect.

If InboxForNow is absent from the first results page, record `not_found_on_first_page` with `rank: null`; do not invent a position such as 11 or 100. If Google presents a CAPTCHA, unavailable results, or an unverifiable locale, record the gap and keep checking other independent evidence. Do not solve a CAPTCHA without the required user action.

Write one normalized `rankings.json` per America/Chicago date. Include all primary queries exactly once. Preserve each original observation time; a copied historical snapshot is not today's observation. Reruns may update the normalized file only from newly collected evidence and should retain previous originals with time suffixes. Format:

```json
{
  "date": "YYYY-MM-DD",
  "country": "usa",
  "language": "en",
  "device": "desktop",
  "source": "Google browser",
  "results": [{
    "query": "temporary email",
    "observedAt": "ISO timestamp with offset",
    "searchUrl": "https://www.google.com/search?q=temporary+email&gl=us&hl=en&pws=0",
    "locationEvidence": "Exact visible US location footer text",
    "status": "not_found_on_first_page",
    "rank": null,
    "resultUrl": null,
    "evidence": "temporary-email-serp.md"
  }]
}
```

For a positive observation use `status: "observed"`, a positive integer rank, `resultPage: 1`, the verified InboxForNow result URL, and `organicEvidence` explaining the counted results and excluded panels. For a failed check, retain a dated original failure snapshot, use `status: "unavailable"`, and leave rank null. The validator accepts a complete normalized day only when the requested locale and source can be verified; otherwise retain the partial evidence and report the gap rather than inventing locale fields.

Run `npm run seo:rankings`. It validates dates, query coverage, source URLs, US location evidence, and source files, and writes `.seo-cache/daily/ranking-status.json`. It verifies completion only when **every primary query has observed organic first-page visibility on two consecutive days, including today**. Search Console average position does not satisfy this condition. The initial October 9 checks found no InboxForNow result on the first page for any primary query; the exact positions remain unknown.

Once the validator reports `goalVerified: true`, disable only the InboxForNow daily SEO heartbeat using the automation tool and report the dated evidence. Continue monitoring before that point, even when metrics access is temporarily unavailable.

## Changes and deployment

Investigate new crawl errors, indexing regressions and meaningful shifts in impressions, clicks or positions. Recheck official sources when modifying platform claims. Make specific evidence-backed fixes, preserve unrelated local work, and run `npm run build` and `npm run check:seo` before publishing. Avoid unsupported compatibility promises, invented testimonials, bulk low-value pages and routine daily title changes.

The initial changes were directly deployed to Cloudflare Pages production using the existing project token. The October 12 reproducibility review published the deployed SEO source and checks in commit `2c5bf66`, with a fresh install/build matching all 69 production-build files byte-for-byte. Commit `3b16667` replaced the unresolved legacy Pages action with the maintained Wrangler action; its GitHub workflow and Cloudflare production deployment both succeeded. Preserve these source changes in future builds. The frontend workflow runs build, SEO checks and inbox/QR tests before deploying; it does not run interactive GSC authorization. Publication evidence is recorded in the worklog. Do not push or merge unrelated work, buy services or links, or contact third parties as part of this monitor.

The created automation ID is `inboxfornow-daily-seo`. Its daily recurrence is 9:00 AM in the app's America/Chicago timezone. Use the automation tool to update or disable this exact ID; do not create duplicate monitors.

## Active improvement work (user correction, October 11)

The goal is now first-page visibility for all three primary queries, replacing the earlier number-one target. A daily run must move beyond repeating the same crawl and rankings: read docs/seo-worklog.md, choose the highest-priority open item, conduct a focused investigation, and implement and publish a justified improvement when available. Record the evidence, decision, validation, deployment, and next action in the worklog. If an investigation establishes that a change should wait for data, record the result and advance another independent item; do not force cosmetic edits.

Priorities include indexing/discovery, product usefulness and reliability, original tested guides, internal navigation, and measured loading issues. Expired GSC authorization is not a reason to stop independent work. Preserve prior experiments and assess them at 7 and 28 days rather than rewriting the same titles every day. Research authority/discovery opportunities without buying links, posting, or contacting third parties.

Sitemap modification dates come from src/data/editorial-dates.ts, recording substantive changes rather than rebuild times. The shared guide byline/schema reads the same dates. Update only the routes whose visible content materially changes, never all dates on a rebuild. The daily asset parser includes local links with a download attribute, so the October 13 email-QA fixtures receive ongoing availability checks. The frontend workflow also runs their processing checks before deployment.
