# Receiving configuration review — October 11, 2026

The prior goal turn corrected the public project README and repository metadata. This continuation checked a distinct operational dependency: public receiving configuration. An available frontend/API does not by itself prove the mail path is configured or working.

## Observed evidence

- The active-domain API returned HTTP 200 and `veqla.com`.
- Public DNS resolved all three expected Cloudflare routing hosts: `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, and `route3.mx.cloudflare.net`. The observed priorities were 96, 38 and 22 respectively; priority order is recorded, not assumed from host numbering.
- There was one SPF policy, `v=spf1 include:_spf.mx.cloudflare.net ~all`. Its presence does not prove delivery or inbox placement.
- `npm run infra:verify-dns` passed for the brand/receiving nameservers, receiving MX records and API hostname.
- The existing token could read the active Cloudflare zone, but routing settings and catch-all GET endpoints returned HTTP 403. No settings or permissions were changed. The catch-all rule therefore remains unverified in this pass; the response is not evidence of a broken rule.

Original sanitized configuration evidence is saved in `.seo-cache/research/2026-10-11/receiving-configuration.json`. No mailbox identifiers, message content or provider credentials were collected in the report. No SMTP message was sent.

Primary references: [Cloudflare DNS troubleshooting](https://developers.cloudflare.com/dns/troubleshooting/email-issues/), [read-only catch-all rule API](https://developers.cloudflare.com/api/resources/email_routing/subresources/rules/subresources/catch_alls/methods/get/), and [Cloudflare's DNS-over-HTTPS JSON format](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/).

## Monitoring improvement

The prior daily monitor checked whether an active domain existed in the database, but not whether its receiving MX records resolved. Added public MX checks for the bounded active-domain list, using a fixed HTTPS resolver and no provider credentials. Expected hosts are read from the existing infrastructure configuration. Snapshots retain the resolver URL, DNS result code, MX hosts, priorities and TTLs.

Classification distinguishes an absent domain, no MX, null MX, another provider, incomplete configured redundancy, and unverifiable resolver evidence. A missing redundant host is a configuration regression, not a claim of total receiving failure. SERVFAIL, HTTP failure, timeout, malformed/truncated data and invalid input produce an unavailable measurement. The monitor sends no mail and does not read inbox contents.

## Validation and follow-up

Eight offline tests passed, including failure classification and the guarantee that invalid domain names never initiate resolver requests. Diff checks passed. The enhanced live monitor wrote `snapshot-114732.json`: all 31 sitemap pages, robots access, 10 assets, both API checks and the three receiving MX hosts passed. It records the successful DNS result and observed 300-second TTLs. The command still exits nonzero for the already-known GSC RefreshError; crawl and service checks passed. No public page or infrastructure mutation is justified by the healthy public records. Production remains the previous Pages deployment, and the daily heartbeat will use the enhanced monitor in this checkout.

The known Search Console gap and original primary rankings are unchanged. The first-page goal remains incomplete; preserve the planned October 18/November 8 content assessment dates and continue the daily checks.
