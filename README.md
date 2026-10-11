# InboxForNow — temporary email for one-time messages

[InboxForNow](https://inboxfornow.com/) is a free, receive-only temporary email tool
for permitted one-time messages and manual email testing. Open the site, wait for
a live address, and copy it into a form or an application you control. No account
or everyday email address is required.

The project contains an Astro frontend and a Cloudflare Worker backend using D1
and Email Routing. It is connected to a real receiving service; synthetic sample
messages in development are separate from production email delivery.

## Use the live tool

- **Receive email:** create an inbox and wait for an expected message. The browser
  polls the API while the inbox is active. Delivery and sender acceptance are not
  guaranteed.
- **Manage its lifetime:** the initial timer is ten minutes. Extend it before it
  expires, up to 24 hours remaining, or delete the inbox when finished.
- **Read expected content:** received messages are parsed and sanitized before
  display. The tool can identify likely verification codes, but check the message
  itself because automatic detection can select the wrong number.
- **Know the limits:** there is no outbound email, reply, forwarding, attachment
  viewer, SMS verification, or recovery of an expired inbox. Use lasting email
  for accounts, purchases, subscriptions, or work you need to retain.

Do not send sensitive personal information or production credentials to a
temporary inbox. Disposable addresses may be rejected by a sender, and an email
inbox does not replace a platform's phone or identity requirements.

## Practical guides

- [Verification email not arriving](https://inboxfornow.com/guides/email-not-arriving/)
  — distinguish a rejected address, sender delay, expired inbox and browser error.
- [Test signup emails with a temporary inbox](https://inboxfornow.com/guides/testing-signup-emails/)
  — run a manual checklist for a staging application using synthetic data.
- [Platform limits](https://inboxfornow.com/use-case/)
  — read account-recovery risks and documented verification restrictions.
- [How the service works](https://inboxfornow.com/about/),
  [privacy](https://inboxfornow.com/privacy/) and
  [terms](https://inboxfornow.com/terms/).

## Run the frontend locally

Use Node.js 22, matching the repository's deployment workflow:

```sh
npm ci
npm run dev
```

Open the URL Astro prints (normally `http://localhost:4321`). The frontend uses
`https://api.inboxfornow.com` by default. An alternate API can be selected with
`PUBLIC_API_BASE`; its CORS configuration must permit the frontend's origin.
Never put a secret in a `PUBLIC_` environment variable.

For the static build and preview:

```sh
npm run build
npm run preview
```

A static frontend build does not provision an email domain or prove receiving.
Production is deployed separately; record the deployment revision when testing
the live service rather than assuming it matches any particular checkout.

## Backend and infrastructure

The HTTP API, inbound email handler and scheduled cleanup are in
[`workers/inboxfornow-api/`](workers/inboxfornow-api/). Read its
[deployment instructions](workers/inboxfornow-api/README.md) and run its tests
before changing receiving behavior:

```sh
cd workers/inboxfornow-api
npm ci
npm test
```

Domain setup, DNS and Email Routing scripts are under [`infra/`](infra/).
Follow the [infrastructure instructions](infra/README.md) for configuration.
Keep provider credentials and local environment files outside Git. Do not run
infrastructure mutation scripts just to preview the frontend.

## Code map

| Path | Purpose |
|---|---|
| `src/pages/` | Inbox and supporting pages |
| `src/components/` | Address controls, message list, reader and navigation |
| `src/scripts/app.ts` | Browser state, inbox API calls and interactions |
| `src/styles/` | Shared type, theme and layout styles |
| `public/` | Static assets, PWA manifest and service worker |
| `workers/inboxfornow-api/` | HTTP, inbound-email and cleanup Worker |
| `infra/` | Provider and domain configuration scripts |

Controlled tests establish the behavior they cover; they do not establish live
SMTP latency, inbox placement, universal platform acceptance, or email rendering
across other clients.
