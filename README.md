# InboxForNow

A temporary inbox utility designed in the spirit of a small, well-printed magazine.
Built per `docs/Temp-email-strategy.md` — Astro frontend, intended to sit in front of
a Cloudflare Email Worker + D1 backend that is **not** part of this repo yet.

The current code is a fully working **front-end prototype** of the inbox tool. It
mocks the incoming-mail pipeline so you can see the empty state, the populated
state, the reader, the timer, the copy interaction, QR, theme toggle, and PWA
install — without standing up the worker first.

## Run it

```bash
npm install
npm run dev
```

Open the URL Astro prints (default `http://localhost:4321`).

## What you'll see

- **Instant address** in the left card — playful adjective-animal-number @ a
  rotating receiver domain. Click **New** to regenerate.
- **Live countdown** with `+10m / +1h / +24h` extension chips and a **Burn it**
  destructor. The clock turns over second-by-second; the colon blinks.
- **Copy**, **QR**, and **New** all wired with toasts, a tactile copy flash, and
  a tiny SVG QR (decorative — swap in a real QR lib for production).
- **The Postbox** on the right starts empty (with an illustrated envelope and a
  "Try a sample letter" button). About **4 seconds after first load** a demo
  letter arrives so you can see the populated state without clicking.
- **Reader** slides in from the right (or up from the bottom on mobile). It
  honors the "show images" toggle, surfaces a safety pill, renders an OTP block,
  and burns the letter on demand.
- **Theme toggle** — light primary; dark variant respects the same letterpress
  mood with lifted accents. Persisted in `localStorage`.
- **PWA** — manifest, service worker (app-shell cache, network-first HTML),
  iOS meta, and an in-toolbar `Install` button that surfaces only when the
  browser fires `beforeinstallprompt`.

## Project shape

```
public/
  manifest.webmanifest
  sw.js
  favicon.svg
  icons/
    icon.svg            ← master, used in manifest + favicon
    maskable.svg        ← Android adaptive icon (safe-zone respected)
    apple-touch-icon.svg
src/
  layouts/Layout.astro  ← <head>, fonts, theme bootstrap, SW reg
  pages/index.astro     ← composes Header + AddressCard + Postbox + Reader
  components/
    Header.astro        ← masthead nameplate, dateline ornament, install + theme
    AddressCard.astro   ← stamp-framed card, postmark seal, timer, extend chips
    Postbox.astro       ← envelope list, empty state with illustration, ad slot
    EmailReader.astro   ← slide-in / sheet reader with sanitized HTML body
  scripts/
    app.ts              ← all interactivity (state, timer, mock mail, reader)
    pwa.ts              ← beforeinstallprompt handler
  styles/
    tokens.css          ← palette, type scale, spacing, easings
    global.css          ← reset, base, paper grain, buttons, pills, postmark
scripts/
  gen-png-icons.mjs     ← optional sharp script to render PNG fallbacks
docs/
  Temp-email-strategy.md
```

## Wiring up the real backend (next)

The prototype is shaped to accept a real Worker API with minimal change:

1. Replace `simulateOne()` and the `setTimeout(simulateOne, 4200)` boot in
   `src/scripts/app.ts` with a real SSE subscription or `setInterval` poll
   against `GET /api/inbox/:id/messages`.
2. Move the `RECEIVING_DOMAINS` constant server-side so the worker dictates
   which domains are currently un-blacklisted, and have the client read the
   active pool from `GET /api/domains/active`.
3. The reader already expects pre-sanitized HTML in `bodyHtml`. Run DOMPurify
   in the Cloudflare Email Worker, not on the client — defense in depth.

The brand domain (`InboxForNow.com`) must stay decoupled from the receiver
domains per strategy §9. The prototype already reflects this — the visible
address is `<local>@<rotating-receiver-domain>`, never `@inboxfornow.com`.

## PWA — light & full Android support

Chrome 96+ accepts SVG manifest icons, so the prototype ships with SVG only.
For older Android installs you can render PNG fallbacks:

```bash
npm i -D sharp
node scripts/gen-png-icons.mjs
```

This writes `icon-192.png`, `icon-512.png`, and `maskable-512.png` into
`public/icons/`. The manifest already references them.

## Build for deploy

```bash
npm run build      # → dist/
npm run preview    # → serve dist/ on 0.0.0.0
```

`dist/` is fully static. Drop it on Cloudflare Pages, pair it with the Email
Worker, and you're live.

## Domains, DNS, Namecheap & Cloudflare

Go-live DNS and Email Routing are scripted under [`infra/`](infra/). Copy
`infra/env.example` → repo-root `.env` (gitignored) for the Namecheap API key.
See [`infra/README.md`](infra/README.md) for the full ordered checklist.
