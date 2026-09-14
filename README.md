# ⚡ MyTemp
**High-Performance Disposable Temporary Email Service — Cloudflare Pages Edition**

Fork of [KyuuX444/kyzz-temp](https://github.com/KyuuX444/kyzz-temp) re-architected to deploy as a serverless application on **Cloudflare Pages** with state stored in **Cloudflare KV**. No private servers, no Docker, no Node host.

## What's Different From the Original

| Area | Original | This Fork |
|---|---|---|
| Adapter | `@sveltejs/adapter-node` | `@sveltejs/adapter-cloudflare` |
| State (mailboxes/messages) | In-memory `Map` (lost on restart) | **Cloudflare KV** (persistent, edge-replicated) |
| Rate limiter | In-memory sliding window | **Cloudflare KV** sliding window |
| Inbound email | Generic webhook receiver | Webhook + Cloudflare Email Routing ready (`yaoi.web.id`) |
| Domain | Demo domains only | Defaults to your custom domain (e.g. `yaoi.web.id`) |
| Deployment | Node server / Docker | `wrangler pages deploy` (one command) |
| SSE inbox streaming | Works on Node | Works on Pages Functions (with the standard caveats for free plan) |

## Tech Stack

- **Framework**: [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5 Runes](https://svelte.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Adapter**: [`@sveltejs/adapter-cloudflare`](https://kit.svelte.dev/docs/adapter-cloudflare)
- **Runtime**: Cloudflare Workers (via Pages Functions)
- **Storage**: Cloudflare KV (mailboxes, messages, rate-limit)
- **Security**: `sanitize-html`, strict CSP headers, per-IP KV-backed rate limiting

## Prerequisites

- A Cloudflare account (free tier works)
- `wrangler` CLI: `npm install -g wrangler`
- (Optional) A custom domain you own, added to Cloudflare, with **Email Routing** enabled

## One-Time Setup

### 1. Authenticate wrangler

```bash
wrangler login
```

### 2. Create the two KV namespaces

```bash
wrangler kv namespace create MAILBOX_STORE
wrangler kv namespace create MAILBOX_STORE --preview
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create RATE_LIMIT --preview
```

Copy the IDs printed by each command into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MAILBOX_STORE"
id = "abc..."              # from production create
preview_id = "def..."      # from preview create

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "ghi..."
preview_id = "jkl..."
```

### 3. (Optional) Set secrets

```bash
wrangler pages secret put WEBHOOK_SECRET --project-name my-temp
wrangler pages secret put MAIL_API_KEY --project-name my-temp   # only if using mailslurp
```

## Local Development

```bash
bun install
cp .env.example .env
bun run dev
```

For local dev the app falls back to a process-memory shim when KV bindings are absent — UI works, rate limiter works, but state resets when the dev server restarts.

## Deploy

```bash
bun run deploy
```

This runs `vite build` then `wrangler pages deploy .svelte-kit/cloudflare --project-name my-temp`.

Or do it manually:

```bash
bun install
bun run build
wrangler pages deploy .svelte-kit/cloudflare --project-name my-temp
```

On first deploy Cloudflare will create the Pages project for you. After that you'll see the URL printed (e.g. `https://my-temp.pages.dev`).

## Connect a Custom Domain (`yaoi.web.id`)

1. In Cloudflare Dashboard → **Workers & Pages** → `my-temp` → **Custom domains**
2. Click **Set up a custom domain** → enter `yaoi.web.id`
3. Repeat for `www.yaoi.web.id` (optional)
4. Cloudflare auto-issues a certificate and updates DNS. Done.

## Mail Provider Modes

`MAIL_PROVIDER` controls which backend the app uses. Set it in Cloudflare Pages → Settings → Environment variables.

| Provider | Use case | Inbound mail setup |
|---|---|---|
| `webhook` (default) | You own a domain (`yaoi.web.id`) and want real inbound mail | Cloudflare Email Routing → Email Worker → `POST /api/webhook/inbound` |
| `mock` | Demo / development | None — seed messages only |
| `mailgw` | Public zero-config temp mail | None — uses `mail.tm` / `mail.gw` API |
| `mailslurp` | Enterprise / paid inbox service | None — MailSlurp API |
| `improvmx` / `forwardemail` | Alternative forwarding providers | Configure provider's webhook to `POST /api/webhook/inbound` |

### Real Inbound Email with Cloudflare Email Routing

1. Cloudflare Dashboard → `yaoi.web.id` → **Email** → **Email Routing** → enable
2. Add a catch-all route that forwards to a Worker
3. Create the Worker (`email-routing-worker`) — example:

```js
export default {
  async email(message, env, ctx) {
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '';
    const raw = await new Response(message.raw).text();

    await fetch('https://yaoi.web.id/api/webhook/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': env.WEBHOOK_SECRET
      },
      body: JSON.stringify({
        to: to,
        from: from,
        subject: subject,
        text: raw
      })
    });
  }
};
```

4. Bind `WEBHOOK_SECRET` to the Worker (same secret as the Pages app)
5. Set the Email Routing rule to `*@yaoi.web.id` → route to this Worker

## REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/domains` | List advertised domains |
| `POST` | `/api/mailbox` | Create mailbox. Body: `{ username?, domain? }` |
| `GET` | `/api/mailbox/:address` | Get mailbox info |
| `DELETE` | `/api/mailbox/:address` | Delete mailbox |
| `GET` | `/api/mailbox/:address/messages` | List messages |
| `GET` | `/api/mailbox/:address/messages/:id` | Get message detail (sanitized HTML) |
| `DELETE` | `/api/mailbox/:address/messages/:id` | Delete one message |
| `GET` | `/api/mailbox/:address/events` | SSE real-time stream |
| `POST` | `/api/webhook/inbound` | Inbound email receiver |

All non-stream responses follow:

```json
{ "success": true, "data": { ... } }
```

Errors:

```json
{ "success": false, "error": { "code": "INVALID_USERNAME", "message": "..." } }
```

## Project Structure

```
my-temp/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte UI (Navbar, Generator, Inbox, Viewer, ...)
│   │   ├── server/
│   │   │   ├── db.ts        # KV-backed mailbox + rate-limit helpers
│   │   │   ├── mail/        # Mail providers (webhook / mock / mailgw / mailslurp)
│   │   │   └── security/    # HTML sanitizer + KV rate limiter
│   │   ├── stores/          # Svelte 5 reactive stores
│   │   └── utils/
│   ├── routes/
│   │   ├── api/             # REST + SSE + webhook endpoints
│   │   ├── api-docs/        # Interactive API docs page
│   │   ├── faq/
│   │   ├── privacy/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   ├── hooks.server.ts
│   └── app.d.ts             # Cloudflare env type bindings
├── static/
├── wrangler.toml            # KV bindings + non-secret vars
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## License

MIT — original work © [KyuuX444](https://github.com/KyuuX444), Cloudflare migration © repo owner.
