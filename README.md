# ⚡ MyTemp
**High-performance disposable temporary email service — Cloudflare Pages Edition**

Live at **https://yaoi.web.id** (or the preview URL `https://my-temp.pages.dev`)

---

## What Is This?

MyTemp is a self-hostable, serverless, real-time disposable email service. Pick (or auto-generate) an inbox, get verification codes, download attachments, stream new mail live via SSE — all running on Cloudflare's edge network, **no servers to manage**.

It's a fork of [KyuuX444/kyzz-temp](https://github.com/KyuuX444/kyzz-temp), re-architected so the entire stack lives inside Cloudflare's free tier.

---

## ✨ Features

- 📬 **Instant inbox** — random address or custom alias (`alice@yaoi.web.id`), generated in milliseconds.
- 🔄 **Real-time streaming** — Server-Sent Events inbox with auto-reconnect, no polling required.
- 🔍 **Full-text search** — search across subject, sender, and preview bodies.
- 📤 **Export & archive** — download your inbox as `jsonl` or `json` at any time.
- 🛡️ **Strict sanitization** — every email body passes through `sanitize-html` with an allowlist before render.
- 🚦 **Edge rate limiting** — KV-backed sliding-window, shared globally, no per-isolate drift.
- 🔌 **6 mail providers** — webhook (default, real inbound), mock (demo), mailgw, mailslurp, ImprovMX, ForwardEmail.
- 🌐 **Interactive REST API** — see the [live API docs](https://yaoi.web.id/api-docs) with a built-in "Try it" panel.
- 🚀 **Zero servers** — deploys with one command; scales from zero to global in seconds.

---

## 🏗️ Architecture

```
┌──────────────────────────────┐
│  Browser / API Client        │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌────────────────────────────────────────────────┐
│  Cloudflare Pages Function (Workers runtime)   │
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
│  • RATE_LIMIT    — sliding window per IP        │
└────────────────────────────────────────────────┘

Inbound mail (provider=webhook):
   Email sender → SMTP → Cloudflare Email Routing → Worker
                                              ↓ POST /api/v1/webhook/inbound
                                              ↓ stored in MAILBOX_STORE
```

---

## 🚀 Quick Start

### 1. Use the hosted instance

Skip the setup — go to **https://yaoi.web.id**, generate an inbox, done.

### 2. Self-host on Cloudflare Pages

```bash
git clone https://github.com/TheyanzXD/my-temp.git
cd my-temp
npm install
```

Then follow the [Deployment Guide](#-deployment-guide) below.

---

## 📡 API Endpoints

All non-stream endpoints follow the envelope:

```json
// success
{ "success": true,  "data": { ... } }

// error
{ "success": false, "error": { "code": "INVALID_ADDRESS", "message": "...", "details": null } }
```

### Core

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness probe, build version |
| `GET` | `/api/v1/providers` | Active + supported providers |
| `GET` | `/api/v1/stats` | Provider, domain counts, config |
| `GET` | `/api/v1/domains` | Advertised domains (cached 5 min) |

### Mailbox

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/mailbox` | Create mailbox. Body: `{ username?, domain?, lifetimeMinutes? }` |
| `GET` | `/api/v1/mailbox/{address}` | Mailbox metadata + messageCount |
| `DELETE` | `/api/v1/mailbox/{address}` | Permanently delete mailbox + all messages |

### Messages

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/mailbox/{address}/messages` | List messages. Query: `?unread&limit&offset` |
| `GET` | `/api/v1/mailbox/{address}/messages/{id}` | Full message body (sanitized HTML + text) |
| `DELETE` | `/api/v1/mailbox/{address}/messages/{id}` | Delete one message |
| `DELETE` | `/api/v1/mailbox/{address}/messages` | Delete all messages in a mailbox |
| `POST` | `/api/v1/mailbox/{address}/mark-all-read` | Mark every unread message as read |

### Search & Stream

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/mailbox/{address}/search?q=...` | Substring search across subject/sender/preview |
| `GET` | `/api/v1/mailbox/{address}/export?format=jsonl|json` | Download all messages as a file |
| `GET` | `/api/v1/mailbox/{address}/events` | Server-Sent Events stream (real-time inbox) |

### Webhook

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/webhook/inbound` | Inbound email receiver (auth via `WEBHOOK_SECRET`) |

### Rate Limits

| Endpoint group | Limit |
|---|---|
| Reads (`/domains`, `/stats`, `/providers`, `/messages`) | 240 req/min/IP |
| Mailbox creation | 30 req/min/IP |
| Delete / search / export | 60 req/min/IP |
| Webhook inbound | 120 req/min/IP |

Over-quota → `HTTP 429` with `Retry-After` header.

---

## 🔌 Mail Providers

Configure via `MAIL_PROVIDER` env var:

| Provider | Inbound mail setup | Use case |
|---|---|---|
| `webhook` *(default)* | Wire Cloudflare Email Routing → Worker → `POST /api/v1/webhook/inbound` | You own a domain (e.g. `yaoi.web.id`) |
| `cloudflare` | Same as webhook | Alias for clarity |
| `improvmx` | ImprovMX webhook → `/api/v1/webhook/inbound` | ImprovMX-managed domain |
| `forwardemail` | ForwardEmail webhook → `/api/v1/webhook/inbound` | ForwardEmail-managed domain |
| `mock` | None | Demo / local dev (seeded sample messages) |
| `mailgw` | None | Uses free `mail.tm` / `mail.gw` public API |
| `mailslurp` | None | MailSlurp enterprise (requires `MAIL_API_KEY`) |

### Example: real inbound mail via Cloudflare Email Routing

1. Cloudflare Dashboard → **Workers & Pages** → `my-temp` → **Custom domains** → attach `yaoi.web.id`
2. `yaoi.web.id` → **Email** → **Email Routing** → enable, add catch-all route
3. Create a Worker (`email-routing-worker`):

   ```js
   export default {
     async email(message, env) {
       const raw = await new Response(message.raw).text();
       await fetch('https://yaoi.web.id/api/v1/webhook/inbound', {
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

Now any mail to `your-alias@yaoi.web.id` shows up in the inbox within 3 seconds (SSE poll interval).

---

## 🛠️ Deployment Guide

### Prerequisites

- Cloudflare account (free tier works)
- Node.js 18+ and `npm` (no bun needed — see the note under Local Development)
- A Cloudflare API token with:
  - Account → Cloudflare Pages → **Edit**
  - Account → Workers KV Storage → **Edit**
  - Account → Account Settings → **Read**
  - Zone → DNS → **Edit** *(only if you want auto-CNAME for the custom domain)*
  - Zone → Zone Settings → **Read**

### Step 1 — Clone & install

```bash
git clone https://github.com/TheyanzXD/my-temp.git
cd my-temp
npm install
```

### Step 2 — Authenticate wrangler

**Option A — OAuth (interactive):**
```bash
wrangler login
```

**Option B — API token (CI / headless):**
```bash
export CLOUDFLARE_API_TOKEN=...   # create at https://dash.cloudflare.com/profile/api-tokens
export CLOUDFLARE_ACCOUNT_ID=...  # right sidebar of the dashboard home
```

### Step 3 — Create KV namespaces

```bash
wrangler kv namespace create MAILBOX_STORE
wrangler kv namespace create MAILBOX_STORE --preview
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create RATE_LIMIT --preview
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

### Step 4 — Set non-secret variables (optional)

Defaults already point to `yaoi.web.id`. To change the domain:

```toml
[vars]
MAIL_PROVIDER = "webhook"
CUSTOM_DOMAINS = "your.domain"
APP_NAME = "YourBrand"
APP_URL = "https://your.domain"
```

### Step 5 — Set secrets (optional, recommended for production)

```bash
wrangler pages secret put WEBHOOK_SECRET --project-name my-temp
wrangler pages secret put MAIL_API_KEY --project-name my-temp   # only if MAIL_PROVIDER=mailslurp
```

### Step 6 — Deploy

```bash
npm run deploy
# equivalent to:
#   npm run build
#   wrangler pages deploy .svelte-kit/cloudflare --project-name my-temp --commit-dirty=true
```

On first deploy Cloudflare creates the `my-temp` Pages project. URL: `https://my-temp.pages.dev`.

### Step 6b — Deploy via Git integration (dashboard)

If you connect the repo in the dashboard instead of using the CLI, set the build
configuration exactly like this:

| Setting | Value |
|---|---|
| **Framework preset** | SvelteKit |
| **Build command** | `npm run build` |
| **Build output directory** | `.svelte-kit/cloudflare` |
| **Environment variables (Production)** | `NODE_VERSION` = `22` (or newer) |

> ⚠️ **Do not set the build command to anything involving bun.** The Cloudflare build
> image detects `bun.lock` and runs `bun install --frozen-lockfile`, which fails with
> `Unknown lockfile version` because the image's bundled bun (1.2.x) is older than the
> bun that generated the lockfile. This repo deliberately contains no `bun.lock` —
> commit only `package-lock.json` and the build will succeed.

### Step 7 — Attach custom domain

**Automatic (recommended — needs DNS write scope on token):**

```bash
curl -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"yaoi.web.id"}' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/my-temp/domains"
```

**Manual:** Cloudflare Dashboard → `yaoi.web.id` → **DNS** → add `CNAME @ → my-temp.pages.dev` (proxied) and `CNAME www → my-temp.pages.dev`.

---

## 🧪 Local Development

```bash
cp .env.example .env       # optional
npm run dev                # vite dev server with HMR
npm run build              # production build → .svelte-kit/cloudflare
npm run check              # svelte-check (typecheck)
npm run preview            # preview the built site
```

> **Note:** Use `npm` (not `bun`) for Cloudflare Pages Git integration. The repo ships a
> `package-lock.json` and no `bun.lock` on purpose — the Cloudflare build image's bundled
> bun (1.2.x) cannot parse lockfiles written by newer bun versions and the build fails with
> `Unknown lockfile version`. With `npm` + `package-lock.json` the build is fully
> reproducible on both the build image and your machine.

Without KV bindings (default in `vite dev`), the app falls back to in-memory shims so the UI still works — but state resets on server restart.

---

## 📂 Project Structure

```
my-temp/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte 5 UI (Navbar, Generator, Inbox, Viewer)
│   │   ├── server/
│   │   │   ├── api/respond.ts        # Shared response helpers (ok/err/rateLimited/getIp)
│   │   │   ├── db.ts                 # KV-backed mailbox + rate-limit helpers
│   │   │   ├── mail/                 # Mail providers (webhook / mock / mailgw / mailslurp)
│   │   │   └── security/             # HTML sanitizer + KV rate limiter
│   │   ├── stores/                   # Svelte 5 reactive stores
│   │   └── utils/
│   ├── routes/
│   │   ├── api/
│   │   │   ├── health/+server.ts
│   │   │   └── v1/
│   │   │       ├── domains/+server.ts
│   │   │       ├── providers/+server.ts
│   │   │       ├── stats/+server.ts
│   │   │       ├── mailbox/+server.ts
│   │   │       ├── mailbox/[address]/+server.ts
│   │   │       ├── mailbox/[address]/messages/+server.ts
│   │   │       ├── mailbox/[address]/messages/[id]/+server.ts
│   │   │       ├── mailbox/[address]/events/+server.ts
│   │   │       ├── mailbox/[address]/search/+server.ts
│   │   │       ├── mailbox/[address]/export/+server.ts
│   │   │       ├── mailbox/[address]/mark-all-read/+server.ts
│   │   │       └── webhook/inbound/+server.ts
│   │   ├── api-docs/+page.svelte     # Interactive API explorer
│   │   ├── faq/
│   │   ├── privacy/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   ├── hooks.server.ts
│   └── app.d.ts             # Cloudflare env types (KVNamespace, Platform)
├── static/
├── wrangler.toml            # KV bindings + non-secret vars
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🔒 Security

- All rendered email HTML passes through `sanitize-html` with a strict tag/attribute allowlist.
- No external script/style execution inside messages.
- Per-IP KV-backed sliding-window rate limiter (configurable via `MAX_REQUESTS_PER_MINUTE`).
- Inbound webhook authentication via `WEBHOOK_SECRET` (Bearer token).
- Default security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc.).
- CORS allowed origins configurable (`CORS_ALLOWED_ORIGINS`).

---

## 🤝 Contributing

PRs welcome. Notable areas:

- Additional mail providers (Postmark, Mailgun, SES inbound)
- WebSocket transport instead of SSE poll
- End-to-end encryption for at-rest messages (client-side key)
- PGP-aware message rendering
- Multi-language UI

---

## 📄 License

MIT — original work © [KyuuX444](https://github.com/KyuuX444), Cloudflare migration & API redesign © repo owner.

---

## 🔗 Links

- Live app: https://yaoi.web.id
- Interactive API docs: https://yaoi.web.id/api-docs
- Upstream fork: https://github.com/KyuuX444/kyzz-temp
- Cloudflare Pages: https://developers.cloudflare.com/pages
- SvelteKit + Cloudflare: https://kit.svelte.dev/docs/adapter-cloudflare
