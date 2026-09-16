# MyTemp Deployment Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create KV namespaces (run once)
npm run kv:create

# 3. Update wrangler.toml with the KV namespace IDs from step 2
# Edit the `id` and `preview_id` fields under [[kv_namespaces]]

# 4. Set secrets (optional, for webhook/mail providers)
npm run secret:set              # WEBHOOK_SECRET
npm run secret:set:mail_api_key # MAIL_API_KEY (for mailslurp)
npm run secret:set:mail_api_url # MAIL_API_URL (for mailslurp)

# 5. Build
npm run build

# 6. Deploy
npm run deploy        # production
npm run deploy:preview # preview branch
```

## Configuration Files

All configuration is self-contained in these files:

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Pages + KV + env vars |
| `svelte.config.js` | SvelteKit adapter config |
| `package.json` | Scripts + dependencies |
| `vite.config.ts` | Vite + Tailwind config |
| `deploy.sh` | Self-contained deploy script |

## Environment Variables

Configured in `wrangler.toml` under `[vars]`:

| Variable | Description | Default |
|----------|-------------|---------|
| `MAIL_PROVIDER` | Provider type: `webhook`, `mock`, `mailslurp`, `mailgw`, `improvmx`, `forwardemail` | `webhook` |
| `CUSTOM_DOMAINS` | Comma-separated domains for webhook provider | `temp.yaoi.my.id` |
| `APP_NAME` | Display name | `MyTemp` |
| `APP_URL` | Public URL | `https://temp.yaoi.my.id` |
| `MAILBOX_LIFETIME_MINUTES` | Mailbox TTL | `60` |
| `MAX_REQUESTS_PER_MINUTE` | Rate limit | `120` |
| `CORS_ALLOWED_ORIGINS` | CORS origins | `*` |
| `WEBHOOK_SECRET` | Webhook auth secret (set via `secret:set`) | - |

## Secrets (set via CLI)

```bash
# Webhook authentication secret
wrangler pages secret put WEBHOOK_SECRET --project-name yanzxd

# MailSlurp (if using)
wrangler pages secret put MAIL_API_KEY --project-name yanzxd
wrangler pages secret put MAIL_API_URL --project-name yanzxd
```

## KV Namespaces

Create once:

```bash
# Production
wrangler kv:namespace create MAILBOX_STORE
wrangler kv:namespace create RATE_LIMIT

# Preview
wrangler kv:namespace create MAILBOX_STORE --preview
wrangler kv:namespace create RATE_LIMIT --preview
```

Then update `wrangler.toml` with the returned IDs.

## Custom Domain

1. In Cloudflare Dashboard → Pages → yanzxd → Custom domains
2. Add `temp.yaoi.my.id` (or your domain)
3. Ensure DNS points to Cloudflare Pages

## Mail Provider Setup

### Webhook (Cloudflare Email Routing / ImprovMX / ForwardEmail)
1. Set `MAIL_PROVIDER = "webhook"` in `wrangler.toml`
2. Set `CUSTOM_DOMAINS = "yourdomain.com"`
3. Configure DNS MX records to point to your email routing service
4. Set webhook URL: `https://yourdomain.com/api/v1/webhook/inbound`
5. Set `WEBHOOK_SECRET` via `npm run secret:set`

### MailSlurp
1. Set `MAIL_PROVIDER = "mailslurp"`
2. Set `MAIL_API_KEY` and `MAIL_API_URL` via secrets

### Mock (Demo/Development)
1. Set `MAIL_PROVIDER = "mock"` - uses KV-backed demo data

## Scripts Reference

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build locally
npm run check            # TypeScript + Svelte check
npm run deploy           # Deploy to production
npm run deploy:preview   # Deploy to preview branch
npm run kv:create        # Create KV namespaces (production)
npm run kv:create:preview # Create KV namespaces (preview)
npm run secret:set       # Set WEBHOOK_SECRET
```

## CI/CD (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: yanzxd
          directory: .svelte-kit/cloudflare
          branch: ${{ github.ref == 'refs/heads/main' && 'production' || 'preview' }}
```

## Troubleshooting

### "Hello World" / Blank Page
- KV namespace IDs not set in `wrangler.toml`
- Custom domain not configured in Cloudflare Pages
- Check Pages deployment logs in Cloudflare Dashboard

### Rate Limited
- Increase `MAX_REQUESTS_PER_MINUTE` in `wrangler.toml`
- Or deploy with higher limits

### Webhook Not Receiving Emails
- Verify `WEBHOOK_SECRET` matches sender
- Check webhook URL is accessible
- Check DNS MX records for domain

### Build Fails
- Run `npm run check` for TypeScript errors
- Clear cache: `rm -rf .svelte-kit node_modules && npm install`

### "Missing entry-point to Worker script" Error
**Cause:** Running `wrangler deploy` instead of `wrangler pages deploy`.

**Fix:** Always use the `pages` subcommand:
```bash
# ❌ WRONG - this deploys as a Worker
wrangler deploy

# ✅ CORRECT - this deploys as Pages
wrangler pages deploy .svelte-kit/cloudflare --project-name yanzxd
```

Or use the npm scripts (which use the correct command):
```bash
npm run deploy        # production
npm run deploy:preview # preview
```

The project is a **Cloudflare Pages** project (SvelteKit + adapter-cloudflare), not a Worker. The `pages` subcommand is required.