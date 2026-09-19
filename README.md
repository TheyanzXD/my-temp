<div align="center">

# ⚡ YanzXD Temp

**Disposable temporary email — serverless, real-time, on Cloudflare's edge.**

[![Live](https://img.shields.io/badge/Live-temp.yaoi.web.id-6366f1?style=for-the-badge&logo=cloudflare&logoColor=white)](https://temp.yaoi.web.id)
[![API Docs](https://img.shields.io/badge/API_Docs-Interactive-22c55e?style=for-the-badge&logo=swagger&logoColor=white)](https://temp.yaoi.web.id/api-docs)
[![License](https://img.shields.io/badge/License-MIT-71717a?style=for-the-badge)](./LICENSE)

SvelteKit · Svelte 5 · Cloudflare Pages · Workers D1 · TailwindCSS v4

</div>

---

## Overview

YanzXD Temp is a self-hostable, serverless, real-time disposable email service. Pick (or auto-generate) an inbox, receive verification codes, stream new mail live via SSE — all running on Cloudflare's edge network, **no servers to manage**.

Fork of [KyuuX444/kyzz-temp](https://github.com/KyuuX444/kyzz-temp), re-architected so the entire stack lives inside Cloudflare's free tier. Now shipping **10 mail providers** behind one API surface, plus a custom-domain (your own address) mode.

## ✨ Features

| | Feature | Details |
|---|---|---|
| 📬 | **Instant inbox** | Random address or custom alias (`alice@yaoi.web.id`), in milliseconds |
| 🌐 | **10 mail providers** | `webhook`, `mailtm`, `tempmailio`, `guerrilla`, `composite`, `five`, `mock`, `mailslurp`, `improvmx`, `forwardemail` |
| 📫 | **17+ domains** | Dropdown unions across every provider — pick your favorite |
| 🔄 | **Real-time streaming** | SSE inbox with auto-reconnect — no polling |
| 🔍 | **Full-text search** | Search across subject, sender, and preview bodies |
| 📤 | **Export & archive** | Download your inbox as `jsonl` or `json` |
| 🪄 | **OTP + URL auto-detect** | One-click copy verification codes from the email body |
| 🛡️ | **Strict sanitization** | Every email body passes `sanitize-html` allowlist before render |
| 🚦 | **Edge rate limiting** | D1-backed sliding window, shared globally across isolates, fail-open on quota |
| 🔌 | **Interactive REST API** | Built-in "Try it" panel at `/api-docs` |
| 📱 | **Share-card rich previews** | Open Graph + Twitter Card metadata so shared links unfurl cleanly in WA / TG / Slack |
| 🚀 | **Zero servers** | One-command deploy, scales globally in seconds |

## 🏗️ Architecture

```
┌──────────────────────────────┐
│  Browser / API Client        │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (Workers runtime)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐   │
│  │ SvelteKit │  │  Svelte  │  │ API v1                   │   │
│  │   UI      │  │  5 runes │  │ /health, /v1/providers,  │   │
│  └──────────┘  └──────────┘  │ /v1/domains, /v1/mailbox  │   │
│                              └──────────┬───────────────┘   │
└──────────────────────────────────────────┬──────────────────┘
                                           │ D1 + KV (legacy)
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare D1 / KV (edge-replicated storage)               │
│  • MAIL_DB (D1)   — mailboxes + message JSON                │
│  • MAILBOX_STORE  — KV fallback for messages               │
│  • RATE_LIMIT     — sliding window per IP                   │
└─────────────────────────────────────────────────────────────┘

Inbound mail (provider=webhook):
   Email → SMTP → Cloudflare Email Routing → Worker
                                      ↓ POST /api/v1/webhook/inbound
                                      ↓ stored in MAIL_DB / KV
```

## 🚀 Quick Start

**Use the hosted instance** — skip the setup, go to **[temp.yaoi.web.id](https://temp.yaoi.web.id)**, generate an inbox, done.

**Self-host:**

```bash
git clone https://github.com/TheyanzXD/yanzxd.git
cd yanzxd
npm install
```

Then follow the [Deployment Guide](#-deployment-guide) below.

## 🌐 Mail Providers

Switch via the `MAIL_PROVIDER` env var. Default: `webhook` (your own Cloudflare Email Routing domain).

| ID | Upstream | Auth | Domains | Lifetime |
|---|---|---|---|---|
| `webhook` | Cloudflare Email Routing / ImprovMX / ForwardEmail | `WEBHOOK_SECRET` | `CUSTOM_DOMAINS` | configurable up to 1440 min |
| `mailtm` | `https://api.mail.tm` (alt: `api.mail.gw`) | none (auto) | uberip.com | upstream |
| `tempmailio` | `https://api.internal.temp-mail.io/api/v3` | per-session token | 7+ public domains | ~10 min upstream |
| `guerrilla` | `https://api.guerrillamail.com/ajax.php` | `sid_token` (auto) | 4 rotating | per session |
| `composite` | `mailtm` → `tempmailio` → `guerrilla` auto-fallback chain | inherits | union | inherits |
| `five` | Five-Provider Auto-Rotator — per-minute round-robin | inherits | union | inherits |
| `mock` | KV-backed deterministic seed (zero network) | none | 5 demo domains | configurable |
| `mailslurp` | `https://docs.mailslurp.com` | `MAIL_API_KEY` | upstream | upstream |
| `improvmx` | ImprovMX webhook frontend (`webhook` under the hood) | `WEBHOOK_SECRET` | configured | configurable |
| `forwardemail` | ForwardEmail webhook frontend (`webhook` under the hood) | `WEBHOOK_SECRET` | configured | configurable |

See `GET /api/v1/providers` and `GET /api/v1/domains/all` for live status. Each row from `/domains/all` carries a `provider` and `providerLabel` so the UI can show source attribution in the domain picker.

> **Cross-provider note.** An address created by `mailtm` cannot be read by `tempmailio`. After flipping `MAIL_PROVIDER` via deploy, in-flight addresses from the old provider become unreadable until their upstream TTL expires. Use `composite` or `five` for rotation across providers without re-issuing addresses.

## 📡 API Reference

All non-stream endpoints follow the envelope:

```json
// success
{ "success": true,  "data": { ... } }

// error
{ "success": false, "error": { "code": "INVALID_ADDRESS", "message": "...", "details": null } }
```

<details>
<summary><b>Core</b></summary>

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness probe, build version |
| `GET` | `/api/v1/providers` | Active + supported providers with docs URLs |
| `GET` | `/api/v1/stats` | Provider, domain counts, config |
| `GET` | `/api/v1/domains` | Active-provider domains only (cached 5 min) |
| `GET` | `/api/v1/domains/all` | Union across all registered providers (with attribution) |
</details>

<details>
<summary><b>Mailbox</b></summary>

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/mailbox` | Create. Body: `{ username?, domain?, lifetimeMinutes? }` |
| `GET` | `/api/v1/mailbox/{address}` | Mailbox metadata + messageCount |
| `DELETE` | `/api/v1/mailbox/{address}` | Delete mailbox + all messages |
</details>

<details>
<summary><b>Messages</b></summary>

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/mailbox/{address}/messages` | List. Query: `?unread&limit&offset` |
| `GET` | `/api/v1/mailbox/{address}/messages/{id}` | Full body (sanitized HTML + text) |
| `DELETE` | `/api/v1/mailbox/{address}/messages/{id}` | Delete one message |
| `DELETE` | `/api/v1/mailbox/{address}/messages` | Delete all messages |
| `POST` | `/api/v1/mailbox/{address}/mark-all-read` | Mark every unread as read |
</details>

<details>
<summary><b>Search, Stream & Webhook</b></summary>

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/mailbox/{address}/search?q=...` | Substring search (subject/sender/preview) |
| `GET` | `/api/v1/mailbox/{address}/export?format=jsonl\|json` | Download all messages |
| `GET` | `/api/v1/mailbox/{address}/events` | SSE stream — real-time inbox |
| `POST` | `/api/v1/webhook/inbound` | Inbound email receiver (auth via `WEBHOOK_SECRET`) |
</details>

**Rate limits**

| Endpoint group | Limit |
|---|---|
| Reads (`/domains`, `/stats`, `/providers`, `/messages`) | 240 req/min/IP |
| Mailbox creation | 30 req/min/IP |
| Delete / search / export | 60 req/min/IP |
| Webhook inbound | 120 req/min/IP |

Over-quota → `HTTP 429` with `Retry-After` header.

> Storage writes are also rate-limited per Cloudflare's free-tier quotas. Mailbox and message writes degrade gracefully (the API still returns the action result) when the D1/KV quota is exhausted — never a hard `5xx`.

For full configuration of every provider, see the **[🌐 Mail Providers](#-mail-providers)** table above.

<details>
<summary><b>Example: real inbound mail via Cloudflare Email Routing</b></summary>

1. Cloudflare Dashboard → **Workers & Pages** → `my-temp` → **Custom domains** → attach `yaoi.web.id`
2. `yaoi.web.id` → **Email** → **Email Routing** → enable, add catch-all route
3. Create a Worker (`email-routing-worker`):

```js
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    await fetch('https://temp.yaoi.web.id/api/v1/webhook/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': env.WEBHOOK_SECRET
      },
      body: JSON.stringify({
        to: message.to,
        from: message.from,
        subject: message.headers.get('subject') || '',
        text: raw
      })
    });
  }
};
```

4. Bind `WEBHOOK_SECRET` (same secret as the Pages app)
5. Email Routing rule: `*@yaoi.web.id` → `email-routing-worker`

Mail to `your-alias@yaoi.web.id` shows up in the inbox within 3 seconds (SSE poll interval).

</details>

## 🛠️ Deployment Guide

### Prerequisites

- Cloudflare account (free tier works)
- Node.js 18+ and `npm`
- Cloudflare API token with:
  - Account → Cloudflare Pages → **Edit**
  - Account → Workers KV Storage → **Edit**
  - Account → Account Settings → **Read**
  - Zone → DNS → **Edit** *(only for auto-CNAME on custom domain)*
  - Zone → Zone Settings → **Read**

### Step 1 — Clone & install

```bash
git clone https://github.com/TheyanzXD/yanzxd.git
cd yanzxd
npm install
```

### Step 2 — Authenticate wrangler

```bash
# Option A — OAuth (interactive)
npx wrangler login

# Option B — API token (CI / headless)
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
```

### Step 3 — Provision storage

This build can read from Cloudflare D1 (primary) **or** legacy Workers KV namespaces. D1 has no daily write limit on the free tier; KV free tier is capped at 1,000 writes / day / namespace.

**Option A — D1 (recommended):**

```bash
# Create the database (run once)
npx wrangler d1 create yanzxd_mail
# Output gives you a database_id — paste it into wrangler.toml:

[[d1_databases]]
binding = "MAIL_DB"
database_name = "yanzxd_mail"
database_id = "..."
```

The schema (`CREATE TABLE kv ...`) bootstraps automatically on first request, so no manual migration is needed.

**Option B — Workers KV (legacy fallback, kept working):**

```bash
npx wrangler kv namespace create MAILBOX_STORE
npx wrangler kv namespace create MAILBOX_STORE --preview
npx wrangler kv namespace create RATE_LIMIT
npx wrangler kv namespace create RATE_LIMIT --preview
```

Copy the IDs into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MAILBOX_STORE"
id = "..."                # production
preview_id = "..."        # preview

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "..."
preview_id = "..."
```

### Step 4 — Set non-secret variables

Defaults point to `yaoi.web.id`. To change:

```toml
[vars]
MAIL_PROVIDER = "webhook"   # see 🌐 Mail Providers table for values
CUSTOM_DOMAINS = "your.domain"
APP_NAME = "YourBrand"
APP_URL = "https://your.domain"
MAILBOX_LIFETIME_MINUTES = "60"
MAX_REQUESTS_PER_MINUTE = "120"
CORS_ALLOWED_ORIGINS = "https://your.domain"
```

### Step 5 — Set secrets

```bash
wrangler pages secret put WEBHOOK_SECRET --project-name yanzxd   # always set
wrangler pages secret put MAIL_API_KEY --project-name yanzxd      # only if MAIL_PROVIDER=mailslurp
```

> ⚠️ Never put secrets in `wrangler.toml` `[vars]`. Use `wrangler pages secret put` instead. Without `WEBHOOK_SECRET`, the webhook endpoint will reject inbound mail with `401 UNAUTHORIZED`.

### Step 6 — Deploy

```bash
npm run build    # build → .svelte-kit/cloudflare
npm run deploy   # wrangler pages deploy → Cloudflare Pages
```

First deploy creates the `yanzxd` Pages project. URL: `https://yanzxd.pages.dev`.

<details>
<summary><b>Step 6b — Deploy via Git integration (dashboard)</b></summary>

Connect the repo in the Cloudflare dashboard instead of CLI:

| Setting | Value |
|---|---|
| **Framework preset** | SvelteKit |
| **Build command** | `npm run build` |
| **Build output directory** | `.svelte-kit/cloudflare` |
| **Environment variables (Production)** | `NODE_VERSION` = `22` |

> ⚠️ **Do not use bun.** The Cloudflare build image detects `bun.lock` and runs
> `bun install --frozen-lockfile`, which fails with `Unknown lockfile version`
> because the image's bundled bun (1.2.x) is older than the bun that wrote the
> lockfile. This repo deliberately ships `package-lock.json` only.

</details>

### Step 7 — Attach custom domain

```bash
curl -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"temp.your.domain"}' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/yanzxd/domains"
```

**Manual:** Dashboard → `your.domain` → **DNS** → `CNAME @ → yanzxd.pages.dev` (proxied). Subdomain `temp.` is recommended so users always see the service URL.

## 📱 Share-Card Preview

Every route serves Open Graph + Twitter Card meta tags so dropped links unfurl correctly inside WhatsApp, Telegram, Discord, Slack, X (Twitter), Facebook, and LinkedIn. A static `1200×630` cover (in `static/og-cover.png`) renders an inbox mockup with your brand wordmark:

```html
<meta property="og:title"       content="YanzXD Temp — Disposable Email" />
<meta property="og:description" content="Disposable temporary email on Cloudflare Pages. One-click inbox, no signup, real-time delivery, export to JSON." />
<meta property="og:image"       content="https://temp.yaoi.web.id/og-cover.png" />
<meta property="og:type"        content="website" />
<meta name="twitter:card"        content="summary_large_image" />
```

Edit `+layout.svelte` to re-brand.

## 🧪 Local Development

```bash
cp .env.example .env    # optional
npm run dev             # vite dev server with HMR
npm run build           # production build → .svelte-kit/cloudflare
npm run check           # svelte-check (typecheck)
npm run preview         # preview the built site
```

> **Note:** Use `npm` (not `bun`). The repo ships `package-lock.json` and no
> `bun.lock` on purpose. Without `MAIL_DB` / KV bindings, `vite dev` falls back
> to in-memory shims so the UI works — state resets on server restart. The
> dedicated `npm run build && npm run preview` flow uses real Cloudflare
> bindings via `wrangler pages dev` for a faithful local preview.

## 📂 Project Structure

```
yanzxd/
├── src/
│   ├── lib/
│   │   ├── components/                  # Svelte 5 UI (Navbar, Generator, Inbox, Viewer, Footer)
│   │   ├── server/
│   │   │   ├── api/respond.ts           # Shared response helpers
│   │   │   ├── db.ts                    # D1 + KV fallback mailbox + rate-limit helpers
│   │   │   ├── mail/                    # Mail providers (10 implementations)
│   │   │   │   ├── composite-provider.ts       # 3-way fallback chain
│   │   │   │   ├── guerrilla-provider.ts       # GuerrillaMail public AJAX
│   │   │   │   ├── mailgw-provider.ts          # Mail.tm / Mail.gw
│   │   │   │   ├── mailslurp-provider.ts       # MailSlurp
│   │   │   │   ├── mock-provider.ts            # KV-backed deterministic seed
│   │   │   │   ├── provider.ts                 # dispatcher + Five-Auto-Rotator
│   │   │   │   ├── tempmailio-provider.ts      # temp-mail.io internal API v3
│   │   │   │   ├── webhook-provider.ts         # CF Email Routing / Webhook
│   │   │   │   ├── extract.ts · mime.ts        # helpers
│   │   │   │   └── index.ts · types.ts
│   │   │   └── security/                # HTML sanitizer + sliding-window rate limiter
│   │   ├── stores/                      # Svelte 5 reactive stores
│   │   └── utils/
│   ├── routes/
│   │   ├── api/v1/                      # REST endpoints
│   │   │   ├── domains/+server.ts       # active-provider domains
│   │   │   ├── domains/all/+server.ts   # union across all providers
│   │   │   ├── mailbox/[address]/…
│   │   │   ├── providers/+server.ts
│   │   │   ├── stats/+server.ts
│   │   │   └── webhook/inbound/+server.ts
│   │   ├── api-docs/+page.svelte        # Interactive API explorer
│   │   ├── faq/ · privacy/
│   │   └── +page.svelte + +layout.svelte  # Main inbox UI + Open Graph meta
│   ├── hooks.server.ts
│   └── app.d.ts                         # Cloudflare env types
├── static/
│   ├── og-cover.png                     # 1200×630 share-card image
│   └── og-cover.svg                     # source for the cover
├── wrangler.toml                         # KV / D1 bindings + non-secret vars
├── svelte.config.js
├── vite.config.ts
└── package.json
```

## 🔒 Security

- Rendered email HTML passes `sanitize-html` with a strict tag/attribute allowlist
- No external script/style execution inside messages
- Per-IP sliding-window rate limiter backed by D1 (KV fallback) — `MAX_REQUESTS_PER_MINUTE`
- Rate limiter is **fail-open**: a D1/KV error cannot cause a request to fail
- Inbound webhook auth via `WEBHOOK_SECRET` (Bearer token or `x-webhook-secret` header)
- Default security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc.)
- CORS restricted to `CORS_ALLOWED_ORIGINS`

## 🤝 Contributing

PRs welcome. Notable areas:

- Additional mail providers (Postmark, Mailgun, SES inbound, mailnesia, dropmail)
- WebSocket transport instead of SSE poll
- End-to-end encryption for at-rest messages (client-side key)
- PGP-aware message rendering
- Multi-language UI
- Arabic / Hebrew / Thai RTL layout

## 📄 License

MIT — original work © [KyuuX444](https://github.com/KyuuX444), Cloudflare migration, multi-provider expansion, and share-card branding © repo owner.

---

<div align="center">

**[⚡ Live app](https://temp.yaoi.web.id)** · **[📖 API Docs](https://temp.yaoi.web.id/api-docs)** · **[🐙 GitHub](https://github.com/TheyanzXD/yanzxd)**

Built with SvelteKit · Cloudflare Pages · Workers D1 · Workers KV

</div>
