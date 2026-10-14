# Expanded US English SEO plan — October 13, 2026

## Scope and evidence

The project identifies https://inboxfornow.com as its canonical website. It uses Astro 6, Cloudflare Pages and a separate receiving Worker/D1 backend. There are 31 sitemap URLs. The user's handoff expands monitoring to actual Google pages 1–4, a private offline dashboard and daily reporting. The finite target list is in `../seo-targets.json`; all 14 targets are priority queries. Completion requires seven consecutive compatible daily observations and review of the originals. This replaces the previous three-query, two-day confirmation scope.

The platform inventory contains 23 existing pages, not 23 verified integrations:

| Category | Existing platform pages | Representative targets |
| --- | --- | --- |
| Social | Discord, Reddit, Twitter/X, TikTok, Instagram, Telegram, YouTube | temp mail discord |
| Gaming | Steam, Epic Games, Roblox, Twitch | temp mail steam |
| Streaming | Netflix, Spotify | temp mail spotify |
| Finance | PayPal, Venmo, Stripe | can you use temp mail for venmo |
| AI tools | ChatGPT, Claude, Gemini | temp email for chatgpt |
| Productivity | Notion, GitHub, Slack | temp email for github; temp mail notion |
| Shopping | Amazon | temporary email for amazon |
| Temporary inbox | Homepage tool | temporary email; temp mail; disposable email |
| Email testing | Original QA guide | temporary email for testing; test signup emails |
| Troubleshooting | Original receiving checklist | temporary email not receiving emails |

The broad terms remain the original objective. Discord, GitHub and ChatGPT query families have appeared in the authorized Search Console evidence. Other category targets are provisional intent hypotheses, not measured search-volume estimates. Existing account pages need specific, sourced usefulness rather than repeated inbox instructions. The original testing guide's executable synthetic examples are a stronger differentiator than additional generic platform pages.

## Current measurements

Signed-out Google US English desktop checks used `gl=us`, `hl=en`, `pws=0` and visible IP-derived locality in Frisco, Texas. Actual Next links were followed. Original DOM, screenshots and integrity hashes are private under `.seo-cache/daily/2026-10-13/`.

- **temp mail:** 39 standard organic results across actual pages 1–4; the site was absent. This is verified absence through page 4.
- **temporary email:** 29 standard organic results across pages 1–3; absent there. The fourth page returned unrelated results despite the requested query, so its preserved evidence is rejected as a valid measurement. Depth remains incomplete.
- **disposable email:** today's earlier first-page absence is retained with its original timestamp. A new attempt encountered Google's unusual-traffic verification challenge. No further Google queries were attempted.
- **Eleven additional targets:** unavailable this run after the challenge, with explicit reasons and null ranks. They are not recorded as absent.

This establishes measurement coverage, not ranking improvement. Google search-tool result order and Search Console average position are never substituted for actual organic positions. Old first-page-only records retain their original scope; expanded targets are not backfilled.

The Search Console API still fails refresh. The existing authorized Chrome session supplied private US/desktop/Web comparison exports: September 14–October 11 versus August 17–September 13, and October 5–11 versus September 28–October 4. Reopened date controls verified those windows. The chart's accessibility text reported invalid dates, and a custom-date control failed validation; those defects are preserved rather than used as evidence. Browser exports do not independently establish the API's final-data state. No private query exports or analytics tables are included in the public repository, and no causal ranking gain is inferred from these small samples.

## Research and implemented improvements

Venmo's existing page was crawled but not indexed at its last September crawl. That is not proof of a current technical block. Replaced its repeated generic steps with specific email-versus-phone verification, missing messages, already-registered addresses and expired inbox guidance. Recommend lasting email for payment-account access and recovery, retain unverified acceptance, and remove the temporary-inbox tool from this route. No financial-account compatibility test or eligibility claim was made.

Primary sources reviewed October 13:

- [Venmo phone and email verification](https://help.venmo.com/cs/articles/phone-and-email-verification-vhel283)
- [Venmo personal-account signup FAQ](https://help.venmo.com/cs/articles/signing-up-for-a-personal-account-faq-vhel187)
- [Venmo signup steps](https://help.venmo.com/cs/articles/how-to-sign-up-for-a-personal-venmo-account-vhel211)
- [Spotify password reset](https://support.spotify.com/us/article/reset-password/) — registered-email access matters for recovery.
- [Notion account settings](https://www.notion.com/help/account-settings) — account-email and verification details warrant specific guidance.
- [Steam Guard code help](https://help.steampowered.com/en/wizard/HelpWithSteamGuardCode) — the FAQ body describes registered-email delivery and spam checks; the page also displayed an error banner.
- Amazon's help entry point could not be retrieved in this run. That source gap remains open; no new Amazon compatibility claim was added.

Discord, GitHub and ChatGPT already have source-specific October 11 guidance. The remaining shared platform pages should be reviewed individually against primary sources and actual user problems. This is not a mandate to rewrite all pages or invent integration tests.

The existing directory now has seven category jump links and contextual links to original testing and receiving help. Only substantively changed Venmo/directory editorial dates advance. URLs, titles and H1s remain stable.

The standalone local dashboard includes all queries, categories, actual yesterday comparisons, historical dates, 7/28/all-day trends, CSV and original evidence links. Missing measurements break chart lines; absence never becomes an invented numeric rank. Fingerprints separate scope changes. Seven-day completion additionally requires a private manual-review attestation bound to original snapshot hashes.

## Validation and next actions

Evidence/dashboard tests cover integrity tampering, locale/device/date mismatches, page-versus-position, null absence, missing dates, scope changes and manual completion review. Browser review covers filters, historical comparisons, download bytes, chart gaps using a separate removed synthetic fixture, 390px layouts and native Venmo disclosures. Build, SEO, inbox/QR, MIME fixture and offline monitor tests are recorded with deployment evidence in `../seo-worklog.md`.

Next daily run: retry unmeasured pages only when Google permits ordinary access; stop again if challenged. Review a specific remaining platform page using primary sources, prioritizing actionable Search Console exclusions and reader problems. Continue measuring broad-query homepage visibility. Research legitimate recognition opportunities without posting or outreach. Do not repeat sitemap submissions or indexing requests to seek priority.

Assess October 11 experiments on October 18 and November 8; assess October 13 changes on October 20 and November 10, accounting for reporting lag and sample size. Technical eligibility is established for the homepage and original guides, but first-page competitive visibility remains unachieved. No timeline or nationwide ranking guarantee is made.
