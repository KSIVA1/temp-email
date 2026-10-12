# Guide navigation review — October 11, 2026

## Evidence and decision

Examined the current built HTML and source after publishing the GitHub guide. The missing-email checklist had incoming links from five pages. Twenty-one existing platform pages had no direct link to it, even though their shared FAQ answers the exact missing-email question. Discord already linked the checklist within its specific guide; the FAQ link also appears there. The testing checklist already had appropriate links from the homepage, directory, troubleshooting and GitHub pages, so no additional generic testing links were added.

Google’s current [link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) recommends standard anchors with resolvable hrefs, descriptive text and relevant cross-references in context. This supports fixing the reader-navigation gap. It does not establish an ideal link count or predict a ranking increase.

## Change

Added one contextual link beside the existing missing-email FAQ answer, using server-rendered anchor markup. It appears on the 22 existing pages that render the shared FAQ. The guide now has incoming links from 26 unique pages, compared with five before: 21 newly connected platform pages, with Discord already connected. Counts are local HTML relationships, not Google crawl or index counts.

Added two specific links in the troubleshooting guide’s limits section: Discord’s email/phone/server guidance and GitHub’s disposable-verification restriction plus separate commit-privacy alternative. Both link directly to relevant sections of the already published pages. No new pages, title changes, scripts, dependencies, keyword-laden anchors or sitemap-date churn.

## Validation

Build, SEO and diff checks passed: 33 HTML files, 31 sitemap URLs and 516 internal links. Original parsed link evidence is saved as `.seo-cache/research/2026-10-11/navigation-before.json` and `navigation-after.json`. The analyzer checked that the two new fragment destinations exist.

Desktop browser verified the shared FAQ with keyboard input: Enter opens the answer, Tab reaches the checklist anchor, and Enter navigates to the correct guide. Following the two platform links reached `/use-case/github/#github-account` and `/use-case/discord/#discord-email`. At 390×844, the guide’s document width and scroll width were both 390px. Original preview DOM/screenshots are retained as `navigation-faq-desktop.*` and `navigation-checklist-phone.*`. Preview API access was unavailable from the local origin; the content navigation works independently of inbox creation.

Preserve today’s original primary-query observations and the October 18/November 8 assessment dates. The first-page goal remains incomplete.

## Published evidence

Published initially as **e6198e44.inboxfornow.pages.dev**, then made sentence spacing explicit after reviewing the screenshot. Final deployment is **11727bb4.inboxfornow.pages.dev**. The final production browser confirmed the actual text contains `required. Follow`, with the correct checklist href. A pinned-preview HTTP comparison returned 403; production verification used the public apex and supported browser. Initial and final original screenshots/DOM are retained separately, with final proof named `navigation-faq-live-final.*`.

Production browser followed the FAQ link to the missing-email guide and verified both platform-section links in that guide. No console warnings/errors were reported, and the platform page generated a real inbox. Post-deployment snapshots `snapshot-120529.json` and `snapshot-120721.json` passed 31 pages, robots, 10 declared assets, API probes and receiving DNS. The nonzero monitor exit remains the known GSC RefreshError. No production message was read, sent or deleted.

The ranking validator at 17:05 UTC retained the original October 11 query observations and reported `goalVerified: false`. The daily automation remains active. Next review the remaining secondary-target ChatGPT page for concrete source-specific guidance rather than adding further generic navigation links. Keep the October 18 and November 8 assessments.
