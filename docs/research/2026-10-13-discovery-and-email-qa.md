# Discovery processing and a reusable email QA resource — October 13, 2026

Today's Google evidence confirms discovery progress, but not first-page visibility for the three primary queries. Signed-out Google US English desktop checks from the visible Frisco, Texas IP-derived locality still show first-page absence. The exact positions remain unknown. Original DOM snapshots, screenshots and normalized rankings are retained privately under `.seo-cache/daily/2026-10-13/`; the ranking validator reports `goalVerified: false`.

## Google processing of the October 12 actions

The existing authorized Search Console browser session showed the sitemap successfully read on October 12 with **31 discovered pages**, up from the older 27-page version. Individual URL Inspection now reports both original guides indexed, with successful Googlebot smartphone fetches, indexing allowed and Google-selected canonicals matching their inspected URLs:

- `/guides/testing-signup-emails/`: last crawl displayed October 12, 11:12:09 PM.
- `/guides/email-not-arriving/`: last crawl displayed October 12, 11:16:10 PM.

The UI did not expose a timezone for those crawl times. This is stronger evidence than the accepted requests recorded yesterday, but it does not establish causation or ranking gains. No sitemap resubmission or repeat indexing requests were made today.

The overall coverage summary still ends October 8 and cannot assess the recent changes. Its one 404 example is the API subdomain root, last crawled July 3; that URL still correctly returns 404 while the actual API service probes pass. It is not a missing website article. Its one crawled-but-unindexed example is the Venmo page. Current URL Inspection also reports that page unindexed, with a successful September 20 fetch, indexing allowed and matching canonical. That inspection has not observed the October changes, so a new technical failure cannot be inferred. Its generic content warrants review for actual reader value.

Private report originals and a separate dated `gsc-browser.json` preserve these observations. The API authorization failure remains correctly recorded; browser access does not renew the API token. No private performance or query exports are published here.

## Improvement: exact downloadable inputs and tested outputs

The existing testing guide described a small HTML example but provided no reusable MIME messages or reproducible processing results. Added three synthetic `.eml` files on the existing guide URL:

1. Plain-text verification code and escaped angle brackets.
2. Multipart text/HTML alternatives and an HTTPS verification link.
3. HTML rendering limits plus an actual synthetic MIME attachment.

The guide documents the expected result, expands the exact processed HTML and links to reproducible test source. It explains replacing both the recipient header and sending envelope, using one's own verified sender and staging link, and the boundary between local processing and SMTP delivery. No external accounts or messages were used in testing.

Three automated cases pass each exact download through the real receiving handler, MIME parser, test database and HTTP message retrieval. Assertions cover subject, sender, extracted code, stored HTML, preview and retrieved body; the attachment marker is absent from storage and response. This supplies original product evidence, not a claim of universal delivery, third-party signup compatibility or superior rankings.

The frontend CI now installs the existing Worker test dependencies and runs these cases before Pages deployment. No backend code, backend deployment configuration or production database changed. Download responses explicitly set attachment and MIME headers in the advanced-mode Pages Worker and remain noindex; the explanatory guide remains indexable. [Cloudflare's header guidance](https://developers.cloudflare.com/pages/configuration/headers/) explains why custom response headers belong in the Pages Functions code in this setup.

## Validation and assessment

Build, SEO output/header checks, all 19 inbox/QR checks and the three new processing cases passed. Browser review at 1280px and 390px verified readable expanded HTML without horizontal page overflow. A browser download matched the tested source byte for byte. Only the substantively expanded guide's modification date changed; the shared guide layout now reads the existing editorial date data for its byline and schema.

Production publication and verification are recorded in the worklog. Review this resource after **7 days (October 20)** and **28 days (November 10)** using actual crawl dates and available US desktop performance evidence; do not infer success from a score or test count. Preserve the October 18/November 8 assessments for the October 11 experiments. Next review the currently unindexed Venmo page for a specific useful replacement or consolidation, then assess broad-query/homepage visibility and legitimate recognition. Do not add more generic platform pages.
