<div align="center">

# ⚡ MyTemp

**Disposable temporary email — serverless, real-time, on Cloudflare's edge.**

[![Live](https://img.shields.io/badge/Live-temp.yaoi.my.id-6366f1?style=for-the-badge&logo=cloudflare&logoColor=white)](https://temp.yaoi.my.id)
[![API Docs](https://img.shields.io/badge/API_Docs-Interactive-22c55e?style=for-the-badge&logo=swagger&logoColor=white)](https://temp.yaoi.my.id/api-docs)
[![License](https://img.shields.io/badge/License-MIT-71717a?style=for-the-badge)](./LICENSE)

SvelteKit · Svelte 5 · Cloudflare Pages · Workers KV · TailwindCSS v4

</div>

---

## Overview

MyTemp is a self-hostable, serverless, real-time disposable email service. Pick (or auto-generate) an inbox, receive verification codes, stream new mail live via SSE — all running on Cloudflare's edge network, **no servers to manage**.

Fork of [KyuuX444/kyzz-temp](https://github.com/KyuuX444/kyzz-temp), re-architected so the entire stack lives inside Cloudflare's free tier.

## ✨ Features

| | Feature | Details |
|---|---|---|
| 📬 | **Instant inbox** | Random address or custom alias (`alice@temp.yaoi.my.id`), in milliseconds |
| 🔄 | **Real-time streaming** | SSE inbox with auto-reconnect — no polling |
| 🔍 | **Full-text search** | Search across subject, sender, and preview bodies |
| 📤 | **Export & archive** | Download your inbox as `jsonl` or `json` |
| 🛡️ | **Strict sanitization** | Every email body passes `sanitize-html` allowlist before render |
| 🚦 | **Edge rate limiting** | KV-backed sliding window, shared globally across isolates |
| 🔌 | **7 mail providers** | webhook (default), mock, mailgw, mailslurp, cloudflare, improvmx, forwardemail |
| 🌐 | **Interactive REST API** | Built-in "Try it" panel at `/api-docs` |
| 🚀 | **Zero servers** | One-command deploy, scales globally in seconds |

## 🏗️ Architecture

```
┌──────────────────────────────┐
│  Browser / API Client        │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌────────────────────────────────────────────────┐
│  Cloudflare Pages (Workers runtime)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ SvelteKit │  │  Svelte  │  │ API v1       │  │
│  │   UI      │  │  5 runes │  │ /health, /v1 │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└──────────────┬─────────────────────────────────┘
               │ KV get/put
               ▼
┌────────────────────────────────────────────────┐
│  Cloudflare KV  (edge-replicated storage)      │
│  • MAILBOX_STORE — mailbox + message JSON      │
│  • RATE_LIMIT    — sliding window per IP       │
└────────────────────────────────────────────────┘

Inbound mail (provider=webhook):
   Email → SMTP → Cloudflare Email Routing → Worker
                                      ↓ POST /api/v1/webhook/inbound
                                      ↓ stored in MAILBOX_STORE
```

## 🚀 Quick Start

**Use the hosted instance** — skip the setup, go to **[temp.yaoi.my.id](https://temp.yaoi.my.id)**, generate an inbox, done.

**Self-host:**

```bash
git clone https://github.com/TheyanzXD/my-temp.git
cd my-temp
npm install
```

Then follow the [Deployment Guide](#-deployment-guide) below.

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
| `GET` | `/api/v1/providers` | Active + supported providers |
| `GET` | `/api/v1/stats` | Provider, domain counts, config |
| `GET` | `/api/v1/domains` | Advertised domains (cached 5 min) |
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

## 🔌 Mail Providers

Configure via `MAIL_PROVIDER` env var:

| Provider | Inbound mail setup | Use case |
|---|---|---|
| `webhook` *(default)* | Cloudflare Email Routing → Worker → `POST /api/v1/webhook/inbound` | You own a domain |
| `cloudflare` | Same as webhook | Alias for clarity |
| `improvmx` | ImprovMX webhook → `/api/v1/webhook/inbound` | ImprovMX-managed domain |
| `forwardemail` | ForwardEmail webhook → `/api/v1/webhook/inbound` | ForwardEmail-managed domain |
| `mock` | None | Demo / local dev (seeded sample messages) |
| `mailgw` | None | Free `mail.tm` / `mail.gw` public API |
| `mailslurp` | None | MailSlurp enterprise (requires `MAIL_API_KEY`) |

<details>
<summary><b>Example: real inbound mail via Cloudflare Email Routing</b></summary>

1. Cloudflare Dashboard → **Workers & Pages** → `my-temp` → **Custom domains** → attach `temp.yaoi.my.id`
2. `temp.yaoi.my.id` → **Email** → **Email Routing** → enable, add catch-all route
3. Create a Worker (`email-routing-worker`):

```js
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    await fetch('https://temp.yaoi.my.id/api/v1/webhook/inbound', {
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
5. Email Routing rule: `*@temp.yaoi.my.id` → `email-routing-worker`

Mail to `your-alias@temp.yaoi.my.id` shows up in the inbox within 3 seconds (SSE poll interval).

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
git clone https://github.com/TheyanzXD/my-temp.git
cd my-temp
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

### Step 3 — Create KV namespaces

```bash
npm run kv:create
# or manually:
# npx wrangler kv namespace create MAILBOX_STORE
# npx wrangler kv namespace create MAILBOX_STORE --preview
# npx wrangler kv namespace create RATE_LIMIT
# npx wrangler kv namespace create RATE_LIMIT --preview
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

Defaults point to `temp.yaoi.my.id`. To change:

```toml
[vars]
MAIL_PROVIDER = "webhook"
CUSTOM_DOMAINS = "your.domain"
APP_NAME = "YourBrand"
APP_URL = "https://your.domain"
CORS_ALLOWED_ORIGINS = "https://your.domain"
```

### Step 5 — Set secrets

```bash
npm run secret:set              # WEBHOOK_SECRET
npm run secret:set:mail_api_key # only if MAIL_PROVIDER=mailslurp
```

> ⚠️ Never put secrets in `wrangler.toml` `[vars]`. Use `wrangler pages secret put` instead.

### Step 6 — Deploy

```bash
npm run build    # build → .svelte-kit/cloudflare
npm run deploy   # wrangler pages deploy → Cloudflare Pages
```

First deploy creates the `my-temp` Pages project. URL: `https://my-temp.pages.dev`.

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
  -d '{"name":"temp.yaoi.my.id"}' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/my-temp/domains"
```

**Manual:** Dashboard → `temp.yaoi.my.id` → **DNS** → `CNAME @ → my-temp.pages.dev` (proxied).

## 🧪 Local Development

```bash
cp .env.example .env    # optional
npm run dev             # vite dev server with HMR
npm run build           # production build → .svelte-kit/cloudflare
npm run check           # svelte-check (typecheck)
npm run preview         # preview the built site
```

> **Note:** Use `npm` (not `bun`). The repo ships `package-lock.json` and no
> `bun.lock` on purpose. Without KV bindings (`vite dev`), the app falls back
> to in-memory shims so the UI works, but state resets on server restart.

## 📂 Project Structure

```
my-temp/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte 5 UI (Navbar, Generator, Inbox, Viewer)
│   │   ├── server/
│   │   │   ├── api/respond.ts        # Shared response helpers
│   │   │   ├── db.ts                 # KV-backed mailbox + rate-limit helpers
│   │   │   ├── mail/                 # Mail providers
│   │   │   └── security/             # HTML sanitizer + KV rate limiter
│   │   ├── stores/                   # Svelte 5 reactive stores
│   │   └── utils/
│   ├── routes/
│   │   ├── api/v1/                   # REST endpoints
│   │   ├── api-docs/+page.svelte     # Interactive API explorer
│   │   ├── faq/ · privacy/
│   │   └── +page.svelte              # Main inbox UI
│   ├── hooks.server.ts
│   └── app.d.ts                      # Cloudflare env types
├── static/
├── deploy.sh              # Self-contained deploy script
├── wrangler.toml          # KV bindings + non-secret vars
├── svelte.config.js
├── vite.config.ts
└── package.json
```

## 🔒 Security

- Rendered email HTML passes `sanitize-html` with a strict tag/attribute allowlist
- No external script/style execution inside messages
- Per-IP KV-backed sliding-window rate limiter (`MAX_REQUESTS_PER_MINUTE`)
- Inbound webhook auth via `WEBHOOK_SECRET` (Bearer token)
- Default security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc.)
- CORS restricted to `CORS_ALLOWED_ORIGINS`

## 🤝 Contributing

PRs welcome. Notable areas:

- Additional mail providers (Postmark, Mailgun, SES inbound)
- WebSocket transport instead of SSE poll
- End-to-end encryption for at-rest messages (client-side key)
- PGP-aware message rendering
- Multi-language UI

## 📄 License

MIT — original work © [KyuuX444](https://github.com/KyuuX444), Cloudflare migration & API redesign © repo owner.

---

<div align="center">

**[⚡ Live app](https://temp.yaoi.my.id)** · **[📖 API Docs](https://temp.yaoi.my.id/api-docs)** · **[🐙 GitHub](https://github.com/TheyanzXD/my-temp)**

Built with SvelteKit · Cloudflare Pages · Workers KV

</div>
