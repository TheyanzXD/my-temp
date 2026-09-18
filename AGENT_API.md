# YanzXD Temp — API Documentation for AI Agents

Base URL: **https://yaoi.web.id**
Source repo: SvelteKit + Cloudflare Workers + Workers KV
Provider: `webhook` (Cloudflare Email Routing / Webhook)

Temporary email service. Create a mailbox, receive email, read it, discard. All responses are JSON wrapped in `{success, data}` or `{success:false, error:{code, message}}`. No authentication is required for read/write endpoints except the inbound webhook. CORS is open (`Access-Control-Allow-Origin: *`), so browsers and agents can call it directly.

---

## Table of Contents

- [Quick start](#quick-start)
- [Conventions](#conventions)
- [Rate limits](#rate-limits)
- [Errors](#errors)
- [Endpoints](#endpoints)
  - [Health](#get-apihealth)
  - [Domains](#get-apiv1domains)
  - [Providers](#get-apiv1providers)
  - [Stats](#get-apiv1stats)
  - [Create mailbox](#post-apiv1mailbox)
  - [Get mailbox](#get-apiv1mailboxaddress)
  - [Delete mailbox](#delete-apiv1mailboxaddress)
  - [List messages](#get-apiv1mailboxaddressmessages)
  - [Get message](#get-apiv1mailboxaddressmessagesid)
  - [Delete message](#delete-apiv1mailboxaddressmessagesid)
  - [Search messages](#get-apiv1mailboxaddresssearch)
  - [Mark all read](#post-apiv1mailboxaddressmark-all-read)
  - [Export mailbox](#get-apiv1mailboxaddressexport)
  - [SSE events](#get-apiv1mailboxaddressevents)
  - [Inbound webhook](#post-apiv1webhookinbound)
- [Data models](#data-models)
- [For AI agents](#for-ai-agents)

---

## Quick start

```bash
# 1. Create a mailbox (random address, 60-minute TTL)
curl -s -X POST https://yaoi.web.id/api/v1/mailbox \
  -H 'content-type: application/json' -d '{}'
# -> {"success":true,"data":{"id":"mb_hook_5zbadzp","address":"silent.ghost4493@yaoi.web.id",...}}

# 2. Poll for messages
curl -s "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493@yaoi.web.id/messages"

# 3. Read a message (also flips isRead to true)
curl -s "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493@yaoi.web.id/messages/msg_abc123"

# 4. Mailbox auto-expires after 60 minutes. Delete early if done.
curl -s -X DELETE "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493@yaoi.web.id"
```

Live domain: `yaoi.web.id` (MX active, status `online`).
`temp.yaoi.web.id` is reserved but **not yet active** (zone still initializing) — do not use it.

---

## Conventions

| Item | Value |
|---|---|
| Base URL | `https://yaoi.web.id` |
| API prefix | `/api/v1` (health is at `/api`) |
| Request body | `application/json` for POST |
| Success response | `{ "success": true, "data": <payload> }` |
| Error response | `{ "success": false, "error": { "code": "<CODE>", "message": "<human text>" } }` |
| Auth | None for public endpoints. Inbound webhook needs `WEBHOOK_SECRET`. |
| Timestamps | ISO 8601 UTC, e.g. `2026-09-16T01:18:26.736Z` |
| IDs | Mailbox `mb_hook_<random>`, message `msg_<random>` |
| Address encoding | URL-encode the `@` as `%40` and any dot/plus in the local part. `+` in a path segment decodes to a space — always encode it. |
| Storage | Cloudflare Workers KV (eventually consistent; a message may take a second or two to appear after delivery) |

**Address in URL paths.** Every path below takes the full address (`user@yaoi.web.id`). Safe form: `silent.ghost4493%40yaoi.web.id`. Raw `@` also works in practice, but percent-encoding is portable across HTTP clients, proxies, and shell history expansion.

---

## Rate limits

| Scope | Limit | Notes |
|---|---|---|
| Global, per IP | **120 requests / minute** | Applies to all endpoints. |
| Mailbox creation, per IP | **30 / hour** | `POST /api/v1/mailbox`. Enforced separately from the global limit. |

Exceeding a limit returns HTTP 429 with error code `RATE_LIMIT_EXCEEDED` (or `TOO_MANY_REQUESTS`) and a `Retry-After`-style hint in the message. See [Backoff strategy](#backoff-strategy).

Both limits are per source IP. Behind a shared NAT/proxy they are shared — spread requests in time rather than bursting.

---

## Errors

Every failure returns the same shape:

```json
{ "success": false, "error": { "code": "MAILBOX_NOT_FOUND", "message": "Mailbox not found or expired" } }
```

The HTTP status code matches the error class. Always branch on `success`, and use `error.code` (stable) rather than `error.message` (human text, may change) for control flow.

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_USERNAME` | 400 | Username failed regex `^[a-zA-Z0-9._-]{2,30}$` |
| `INVALID_DOMAIN` | 400 | Domain not in the active domain list |
| `INVALID_LIFETIME` | 400 | `lifetimeMinutes` outside 1–1440 |
| `VALIDATION_ERROR` | 400 | Malformed request body / missing required field |
| `UNAUTHORIZED` | 401 | Webhook secret missing or wrong |
| `MAILBOX_NOT_FOUND` | 404 | Address unknown, already deleted, or TTL expired |
| `MESSAGE_NOT_FOUND` | 404 | Message ID unknown or does not belong to this mailbox |
| `RATE_LIMIT_EXCEEDED` | 429 | Global 120/min or create 30/hr limit hit |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP verb for the route |
| `WEBHOOK_FAILED` | 500 | Inbound webhook could not store the email |
| `INTERNAL_ERROR` | 500 | Unexpected server failure — retry with backoff |

---

## Endpoints

### `GET /api/health`

Liveness probe. Not versioned, not wrapped in `success`.

**Response 200**

```json
{
  "ok": true,
  "service": "yanzxd",
  "version": "1.0.0",
  "timestamp": "2026-09-16T01:18:24.115Z",
  "colo": "SIN"
}
```

```bash
curl -s https://yaoi.web.id/api/health
```

Use before any multi-step workflow to confirm the service is up and to learn which Cloudflare colo you are hitting. `ok: true` is the readiness signal.

---

### `GET /api/v1/domains`

Lists domains the service can receive mail on.

**Response 200**

```json
{
  "success": true,
  "data": {
    "domains": [
      {
        "domain": "yaoi.web.id",
        "status": "online",
        "availability": true,
        "mxStatus": "active",
        "lastChecked": "2026-09-16T01:18:25.486Z"
      }
    ],
    "count": 1
  }
}
```

```bash
curl -s https://yaoi.web.id/api/v1/domains
```

Only use a domain when `availability === true && status === "online"`. An offline domain will accept mailbox creation but never receive mail.

---

### `GET /api/v1/providers`

Lists the active mail provider and alternatives this deployment could switch to.

**Response 200**

```json
{
  "success": true,
  "data": {
    "active": { "id": "webhook", "name": "Cloudflare Email Routing / Webhook" },
    "available": [
      { "id": "webhook",   "name": "Cloudflare Email Routing / Webhook", "needs": "Cloudflare Email Routing or ImprovMX/ForwardEmail" },
      { "id": "mock",      "name": "KV-backed Demo",                     "needs": "none" },
      { "id": "mailgw",    "name": "mail.tm / mail.gw Public API",       "needs": "none" },
      { "id": "mailslurp", "name": "MailSlurp Enterprise",               "needs": "MAIL_API_KEY" },
      { "id": "improvmx",  "name": "ImprovMX Webhook",                   "needs": "ImprovMX account" },
      { "id": "forwardemail", "name": "ForwardEmail Webhook",            "needs": "ForwardEmail account" }
    ],
    "customDomains": ["yaoi.web.id"]
  }
}
```

```bash
curl -s https://yaoi.web.id/api/v1/providers
```

For agents: this endpoint is informational. `active.id` tells you the delivery path — with `webhook`, inbound mail arrives via `POST /api/v1/webhook/inbound`, and you cannot send mail into a mailbox from this API without the secret.

---

### `GET /api/v1/stats`

Service configuration and counts.

**Response 200**

```json
{
  "success": true,
  "data": {
    "provider": { "id": "webhook", "name": "Cloudflare Email Routing / Webhook" },
    "domains": { "total": 1, "online": 1 },
    "config": {
      "maxRequestsPerMinute": 120,
      "mailboxLifetimeMinutes": 60,
      "customDomains": ["yaoi.web.id"]
    },
    "uptime": { "timestamp": "2026-09-16T01:18:24.939Z" }
  }
}
```

```bash
curl -s https://yaoi.web.id/api/v1/stats
```

Read `config.mailboxLifetimeMinutes` at the start of a session to size your polling window — do not hardcode 60, it is deployment-configurable.

---

### `POST /api/v1/mailbox`

Creates a mailbox. Returns the address you will poll.

**Request body** (all optional)

| Field | Type | Default | Constraint |
|---|---|---|---|
| `username` | string | random adjective-noun + digits | Regex `^[a-zA-Z0-9._-]{2,30}$`. Not unique — re-using an existing username returns that mailbox if still alive. |
| `domain` | string | first online domain | Must be in `GET /api/v1/domains` with `availability: true` |
| `lifetimeMinutes` | number | `60` (from `/stats`) | Integer `1`–`1440` |

**Response 201**

```json
{
  "success": true,
  "data": {
    "id": "mb_hook_5zbadzp",
    "address": "silent.ghost4493@yaoi.web.id",
    "domain": "yaoi.web.id",
    "createdAt": "2026-09-16T01:18:26.736Z",
    "expiresAt": "2026-09-16T02:18:26.736Z"
  }
}
```

`messageCount` is present and is `0` at creation.

```bash
# Random address
curl -s -X POST https://yaoi.web.id/api/v1/mailbox \
  -H 'content-type: application/json' -d '{}'

# Chosen username, extended lifetime
curl -s -X POST https://yaoi.web.id/api/v1/mailbox \
  -H 'content-type: application/json' \
  -d '{"username":"agent-7","domain":"yaoi.web.id","lifetimeMinutes":120}'
```

Rate limited at **30 creations per hour per IP**. Prefer deterministic usernames across retries over hammering creation — an address is reusable for its whole lifetime.

---

### `GET /api/v1/mailbox/[address]`

Fetch mailbox metadata.

**Response 200**

```json
{
  "success": true,
  "data": {
    "id": "mb_hook_5zbadzp",
    "address": "silent.ghost4493@yaoi.web.id",
    "domain": "yaoi.web.id",
    "createdAt": "2026-09-16T01:18:26.736Z",
    "expiresAt": "2026-09-16T02:18:26.736Z",
    "messageCount": 0
  }
}
```

**404** — `MAILBOX_NOT_FOUND`, "Mailbox not found or expired". Same response for never-existed and TTL-expired.

```bash
curl -s "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id"
```

Use this to check `expiresAt` and compute how much polling time you have left.

---

### `DELETE /api/v1/mailbox/[address]`

Deletes the mailbox and all its messages immediately. Irreversible.

**Response 200**

```json
{ "success": true, "data": { "deleted": true, "address": "silent.ghost4493@yaoi.web.id" } }
```

```bash
curl -s -X DELETE "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id"
```

Calling delete on an expired or unknown mailbox still returns `deleted: true` — it is idempotent, safe to retry.

---

### `GET /api/v1/mailbox/[address]/messages`

Lists messages, newest first.

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `offset` | integer | `0` | Skips this many messages |
| `limit` | integer | `200` | Server cap is 200 per page |

**Response 200**

```json
{
  "success": true,
  "data": {
    "address": "silent.ghost4493@yaoi.web.id",
    "total": 0,
    "count": 0,
    "offset": 0,
    "limit": 200,
    "hasMore": false,
    "messages": []
  }
}
```

`total` is the mailbox's lifetime message count; `count` is what this page returned. With `limit: 200` and `total <= 200` you get everything in one call — the common case.

```bash
curl -s "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id/messages?offset=0&limit=50"
```

Mailboxes hold a **maximum of 200 messages**; beyond that the oldest are evicted. A `total` pinned at 200 with `hasMore: false` means eviction has started.

---

### `GET /api/v1/mailbox/[address]/messages/[id]`

Fetches one message. **Side effect:** sets `isRead: true` on first fetch.

**Response 200** — see [EmailMessageDetail](#emailmessagedetail).

```bash
curl -s "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id/messages/msg_abc123"
```

This is the only endpoint that returns full `body`/`html`. List endpoints return previews only, so this call is mandatory before extracting verification codes or links.

---

### `DELETE /api/v1/mailbox/[address]/messages/[id]`

Deletes one message. Irreversible.

**Response 200**

```json
{ "success": true, "data": { "deleted": true, "id": "msg_abc123" } }
```

```bash
curl -s -X DELETE "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id/messages/msg_abc123"
```

---

### `GET /api/v1/mailbox/[address]/search`

Server-side substring search over a mailbox's messages.

**Query parameters**

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes | Matched against sender, sender name, subject, and body |

**Response 200**

```json
{
  "success": true,
  "data": {
    "address": "silent.ghost4493@yaoi.web.id",
    "query": "verification",
    "count": 0,
    "messages": []
  }
}
```

```bash
curl -s -G "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id/search" \
  --data-urlencode 'q=verification'
```

Cheaper than paging the whole list when you know the target keyword. Returns message summaries; fetch by `id` for the full body. Empty or missing `q` returns `count: 0`, never an error.

---

### `POST /api/v1/mailbox/[address]/mark-all-read`

Sets `isRead: true` on every message in the mailbox.

**Response 200**

```json
{
  "success": true,
  "data": { "address": "silent.ghost4493@yaoi.web.id", "updated": 0 }
}
```

```bash
curl -s -X POST "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id/mark-all-read"
```

`updated` is the number of messages flipped. Useful for a "clear the unread badge" step, or to reset state before a fresh test run.

---

### `GET /api/v1/mailbox/[address]/export`

Downloads the entire mailbox as newline-delimited JSON.

**Response 200** — `Content-Type: application/x-ndjson`, `Content-Disposition: attachment; filename="<address>-<date>.jsonl"`. Each line is one full message JSON. An empty mailbox returns a single newline.

```bash
curl -s -o mailbox.jsonl "https://yaoi.web.id/api/v1/mailbox/silent.ghost4493%40yaoi.web.id/export"
cat mailbox.jsonl | jq -s 'length'
```

Prefer this over paging when `total` is large and you want everything locally in one request — it costs a single rate-limit unit instead of N.

---

### `GET /api/v1/mailbox/[address]/events`

Server-Sent Events stream. Long-lived connection; the server pushes a `mailbox_status` snapshot and the current message list every ~3 seconds, plus `ping` keepalives.

**Response** — `Content-Type: text/event-stream`

```bash
curl -sN "https://yaoi.web.id/api/v1/mailbox/ok_user%40yaoi.web.id/events"
```

**Event types**

| `event:` | `data:` payload | Meaning |
|---|---|---|
| `connected` | `{ address, timestamp }` | Stream established |
| `mailbox_status` | `{ mailbox: { id, address, domain, createdAt, expiresAt, messageCount } }` | Snapshot, pushed on connect and every poll cycle |
| `messages` | `{ messages: [ ...message summaries ] }` | Current message list, pushed on connect and when new mail lands |
| `ping` | `{ time: <epoch ms> }` | Keepalive (~every 3 s) |
| `error` | `{ error, expired: true }` | Mailbox gone/expired — close the stream |

If the address does not exist, the first event is `error` with `"expired": true` and the connection closes.

```bash
# Stream until a message arrives, then quit
curl -sN "https://yaoi.web.id/api/v1/mailbox/ok_user%40yaoi.web.id/events" | grep --line-buffered -m1 -A1 '^event: messages'
```

Agents must honor `text/event-stream` framing: split on blank lines, read `event:` and `data:` lines. Do not JSON-parse the raw body. Reconnect with a fresh request if the socket drops — there is no `Last-Event-ID` resume; you get a full snapshot on reconnect.

---

### `POST /api/v1/webhook/inbound`

Delivers an email into a mailbox. **Requires the deployment's `WEBHOOK_SECRET`.** Auto-creates the mailbox if it does not exist. This is the ingress path that Cloudflare Email Routing calls; as an agent you will normally only need it for testing.

**Headers** — one of:

```
Authorization: Bearer <WEBHOOK_SECRET>
x-webhook-secret: <WEBHOOK_SECRET>
```

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string | yes | Recipient address; mailbox is auto-created from this |
| `from` | string | yes | Sender email |
| `fromName` | string | no | Sender display name |
| `subject` | string | yes | Subject line |
| `text` | string | no | Plain-text body |
| `html` | string | no | HTML body |

**Response 200**

```json
{ "success": true, "data": { ...message... } }
```

**401** — `UNAUTHORIZED`, "Unauthorized webhook request" — secret missing or wrong.

```bash
curl -s -X POST https://yaoi.web.id/api/v1/webhook/inbound \
  -H 'authorization: Bearer ***' \
  -H 'content-type: application/json' \
  -d '{"to":"ok_user@yaoi.web.id","from":"sender@example.com","fromName":"Test","subject":"Hello agent","text":"body text","html":"<b>hi</b>"}'
```

You cannot read the secret from this API. If your workflow needs to inject mail, obtain `WEBHOOK_SECRET` from the deployment owner out of band.

---

## Data models

### EmailMessageSummary

Returned by list and search endpoints.

```json
{
  "id": "msg_abc123",
  "from": "sender@example.com",
  "fromName": "Test",
  "to": "ok_user@yaoi.web.id",
  "subject": "Hello agent",
  "preview": "First ~100 characters of the text body…",
  "isRead": false,
  "receivedAt": "2026-09-16T01:20:00.000Z",
  "size": 42
}
```

### EmailMessageDetail

Returned by `GET .../messages/[id]` and by the webhook. Fetching this marks the message read.

```json
{
  "id": "msg_abc123",
  "from": "sender@example.com",
  "fromName": "Test",
  "to": "ok_user@yaoi.web.id",
  "subject": "Hello agent",
  "body": "Full plain-text body",
  "html": "<b>hi</b>",
  "isRead": true,
  "receivedAt": "2026-09-16T01:20:00.000Z",
  "size": 42
}
```

### Mailbox

```json
{
  "id": "mb_hook_5zbadzp",
  "address": "silent.ghost4493@yaoi.web.id",
  "domain": "yaoi.web.id",
  "createdAt": "2026-09-16T01:18:26.736Z",
  "expiresAt": "2026-09-16T02:18:26.736Z",
  "messageCount": 0
}
```

### Lifecycle limits

| Resource | TTL |
|---|---|
| Mailbox | 60 min default (`lifetimeMinutes` 1–1440 at creation) |
| Message | 24 h, capped by mailbox expiry |
| Messages per mailbox | 200 max, oldest evicted |

Storage is Workers KV: writes are eventually consistent, so a message can take 1–3 seconds to become readable after the webhook 200s. Retry once before concluding mail is missing.

---

## For AI agents

### Recommended workflow

```text
1. GET  /api/health                          -> confirm ok:true
2. GET  /api/v1/stats                        -> read mailboxLifetimeMinutes, maxRequestsPerMinute
3. GET  /api/v1/domains                      -> pick an online, available domain
4. POST /api/v1/mailbox {username?, lifetimeMinutes?}
                                          -> store data.address, data.expiresAt
5. Hand the address to the user / third party.
6. Wait for mail:
     polling -> GET /api/v1/mailbox/<addr>/messages   every 3-5 s
     streaming-> GET /api/v1/mailbox/<addr>/events    (one connection)
7. GET /api/v1/mailbox/<addr>/messages/<id>  -> full body, extract code/link
8. DELETE /api/v1/mailbox/<addr>             -> clean up
```

Create the mailbox **once** and reuse the address for the whole session. Re-creating a mailbox to "reset" state burns the 30/hour creation budget; a mailbox that already exists returns its current state instead.

### Polling vs SSE

**Polling** — simplest, works everywhere, survives proxies and short timeouts.

- Interval **3–5 seconds**. The server polls its own store every ~3 s, so polling faster than that only wastes your rate-limit budget.
- Use the `total`/`count`/`hasMore` fields, not array length heuristics, to decide whether mail arrived.
- Stop when `Date.now() >= Date.parse(expiresAt)`.

**SSE** — lower latency and lower cost: one connection replaces repeated `messages` calls, so it does not consume the 120/min budget while idle.

- Use when you expect a long wait (>30 s) and the runtime supports streaming reads.
- Treat `ping` as a liveness signal only — it carries no mail data.
- On `event: error`, the mailbox is gone; stop, do not reconnect in a loop.
- Reconnect by re-issuing the request. You receive a full `mailbox_status` + `messages` snapshot immediately, so no state is lost.

**Rule of thumb:** expected wait under ~30 s → poll. Over 30 s, or when running many mailboxes per process → SSE.

### Backoff strategy

```text
attempt 1        -> immediate
attempt 2        -> wait 1 s
attempt 3        -> wait 2 s
attempt 4        -> wait 4 s
attempt 5+       -> wait 8 s, cap at 8 s
on HTTP 429      -> honor Retry-After if present, else 60 s, then resume at 8 s
on 5xx           -> exponential backoff, max 3 retries
on 4xx (non-429) -> do NOT retry; the request is wrong, not transient
```

Retry only on 429 and 5xx. A 400/404/401 is deterministic — retrying an expired mailbox (`MAILBOX_NOT_FOUND`) always 404s; create a new mailbox instead. Add jitter (±20%) to avoid synchronizing with other agents behind the same IP.

Budget check before each call: keep a local counter. The global limit is 120/min and the create limit is 30/hour; a polling loop at 4 s intervals spends 15 of those 120, leaving ample headroom for message reads.

### Address URL-encoding

Mailbox addresses appear in the URL path and contain characters that need encoding:

| Character | Encode as | Why |
|---|---|---|
| `@` | `%40` | Separates userinfo from host in some parsers; proxies may mangle it |
| `.` | `%2E` (optional) | Harmless raw; encode only if a client double-decodes paths |
| `+` | `%2B` | **Mandatory.** A raw `+` in a path decodes to a space, silently turning `a+b@domain` into `a b@domain` and yielding `MAILBOX_NOT_FOUND`. |

```bash
# shell-safe, handles @ and + correctly
ADDR='silent.ghost4493@yaoi.web.id'
ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$ADDR")
curl -s "https://yaoi.web.id/api/v1/mailbox/$ENC/messages"

# or let curl encode the query string for /search
curl -s -G "https://yaoi.web.id/api/v1/mailbox/$ENC/search" --data-urlencode 'q=verification code'
```

In JavaScript: `encodeURIComponent(address)`. In Python: `urllib.parse.quote(address, safe='')`. Never use `encodeURI` — it leaves `@` and `+` untouched.

### Idempotency and state

- `DELETE /api/v1/mailbox/[address]` is idempotent — safe to call twice, both return `deleted: true`.
- `GET .../messages/[id]` is **not** idempotent for state: it flips `isRead` to `true`. If unread state matters to your workflow, record it before fetching.
- Re-`POST /api/v1/mailbox` with an existing live `username` returns that mailbox rather than failing. Useful for resuming after a crash; note the response is 200 in that path, not 201.
- Mailboxes are not reclaimable after expiry. Once `expiresAt` passes, the address and its mail are gone.

### Cleanup hygiene

Always `DELETE` the mailbox when your workflow ends early. Expired mailboxes are garbage-collected by TTL, but deleting immediately frees the address for reuse and avoids leaving received mail readable. Never leave a mailbox holding verification codes or session tokens longer than needed.

### Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `MAILBOX_NOT_FOUND` on a fresh mailbox | Address not URL-encoded, or `+` decoded to space | Percent-encode with `safe=''` |
| `INVALID_USERNAME` | Space, uppercase-unsafe char, or length outside 2–30 | Match `^[a-zA-Z0-9._-]{2,30}$` client-side first |
| 429 during a polling loop | Polling faster than 3 s, or shared-IP contention | Raise interval to 5 s, add jitter, switch to SSE |
| 404 on a mailbox created minutes ago | TTL expired, or you are polling a different domain than the one returned in `data.domain` | Re-read `expiresAt`, re-create if expired |
| Message never appears after webhook 200 | KV eventual consistency | Wait 3 s and retry once; then check `/search` |
| `UNAUTHORIZED` on webhook | Secret absent, or `Authorization` header used `Basic` instead of `Bearer` | Use `Authorization: Bearer <secret>` or `x-webhook-secret: <secret>` |
| SSE connection closes immediately | Mailbox does not exist | Create it via `POST /api/v1/mailbox`, then reconnect |

### Rate-limit budget example

A typical verification-code flow costs:

```text
1  health + 1 stats + 1 domains        =  3
1  POST mailbox                       =  1  (also counts against 30/hour)
poll x20 @ 4 s intervals              = 20
1  message detail                     =  1
1  delete                             =  1
                                     ----
                                       26 requests  (of 120/min)
```

Comfortably inside the global limit. Bursting all 20 polls in 5 seconds would still be legal but wasteful — spread them.

---

## Provider Reference

The build ships with **10 mail providers** behind one API surface. Switch via `MAIL_PROVIDER=<id>` env var (default `webhook`).

| ID | Upstream / API | Auth | Domains | Lifetime |
|---|---|---|---|---|
| `webhook` | Cloudflare Email Routing / ImprovMX / ForwardEmail (`POST /api/v1/webhook/inbound`) | `WEBHOOK_SECRET` | configured via `CUSTOM_DOMAINS` | configurable up to 1440 min |
| `mailtm` | `https://api.mail.tm` (alt: `api.mail.gw`) | none (auto-account) | uberip.com | mailbox TTL managed by upstream |
| `tempmailio` | `https://api.internal.temp-mail.io/api/v3` | none (per-session token) | 7+ public domains: ozsaip, yzcalo, lnovic, ruutukf, gmeenramy, olipii, ooynib | ~10 minutes (upstream) |
| `guerrilla` | `https://api.guerrillamail.com/ajax.php` | `sid_token` (auto) | guerrillamail.com, guerrillamailblock.com, sharklasers.com, grr.la | rotated per session |
| `composite` | Composite chain — `mailtm` → `tempmailio` → `guerrilla`, transparent fallback on quota / 5xx | per-provider | union of upstream domains | inherits |
| `five` | Five-Provider Auto-Rotator — rotates per-minute across all five usable providers | inherits | union | inherits |
| `mock` | KV-backed deterministic seed — never makes a network call, never fails | none | tempinbox.org · quickmail.dev · disposafast.io · mailprivy.net · vaultbox.cc | configurable up to 1440 min |
| `mailslurp` | `https://docs.mailslurp.com` | `MAIL_API_KEY` | upstream account domains | upstream |
| `improvmx` / `forwardemail` | alternate webhook frontends → `webhook` provider under the hood | `WEBHOOK_SECRET` / provider secret | configured | configurable |

### Switching providers

```bash
# mail.tm (free public, no setup)
wrangler pages secret put MAIL_PROVIDER --project-name yanzxd   # value: mailtm

# Five-provider auto-rotator (recommended for production: one bad upstream → rotates to the next)
# Set MAIL_PROVIDER=five in wrangler.toml [vars]

# temp-mail.io (7+ domains, no auth)
# Set MAIL_PROVIDER=tempmailio

# guerrilla (multi-domain rotation, no auth)
# Set MAIL_PROVIDER=guerrilla

# composite (mail.tm → tempmailio → guerrilla auto-fallback)
# Set MAIL_PROVIDER=composite
```

### Choosing one

- **For evaluation**: `webhook` (your own domain) — most reliable, full control.
- **For zero-setup demo**: `mailtm` — fastest, single GET against `api.mail.tm`.
- **For multi-domain variety**: `tempmailio` — exposes 7+ public domains automatically.
- **For max uptime without work**: `five` or `composite` — when one upstream is down the next one is tried.

### Provider outputs are NOT cross-compatible

An address created by `mailtm` cannot be read by `tempmailio`. Each provider manages its own mailbox namespace. Stick to a single provider per deployment, or use `five`/`composite` for rotation. After a deploy that flips `MAIL_PROVIDER`, any in-flight addresses from the old provider become unreadable until the upstream's TTL expires.

---

## Reference

- Live service: https://yaoi.web.id
- Interactive API docs (human): https://yaoi.web.id/api-docs
- Provider: Cloudflare Workers + Workers KV, `webhook` provider via Cloudflare Email Routing
- Health colo: `SIN` — requests are served from the Cloudflare datacenter nearest the client
