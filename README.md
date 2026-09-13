<div align="center">

# ⚡ Kyzz Temp

**High-Performance, Modern & Secure Disposable Temporary Email Service**

[![SvelteKit 2](https://img.shields.io/badge/SvelteKit-2.0-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5%20Runes-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev/)
[![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

*Instant disposable mailboxes, real-time message streaming via Server-Sent Events (SSE), XSS protection sanitizer, multi-provider architecture, and minimalist modern UI.*

---

</div>

## ✨ Key Features

- ⚡ **Instant Mailbox Generation** — Generate random addresses or custom user aliases in milliseconds.
- 🔄 **Real-Time Inbox Streaming (SSE)** — Zero-refresh inbox powered by lightweight Server-Sent Events with automatic reconnection.
- 🎨 **Minimalist Clean UI** — Pure modern white aesthetic, responsive mobile navigation drawer, and seamless UX.
- 🛡️ **Built-in Security & Privacy** — Strict HTML sanitization (`sanitize-html`), sandbox email body rendering, CSP policies, and IP rate limiting.
- 🔌 **Multi-Provider Mail Architecture**:
  - **Mail.gw / Mail.tm API** (Public zero-config backend with dynamic domain pooling)
  - **Custom Webhook Inbound** (Cloudflare Email Routing, ImprovMX, ForwardEmail, SendGrid)
  - **MailSlurp API** (Enterprise inbox provider)
  - **Interactive Mock Provider** (For local testing & offline development)
- 🚀 **Developer REST API** — Public endpoints to create mailboxes, list messages, stream SSE updates, and receive webhooks.

---

## 🏗️ Tech Stack

- **Framework**: [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5 Runes](https://svelte.dev/) (`$state`, `$derived`, `$effect`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Security**: [sanitize-html](https://www.npmjs.com/package/sanitize-html), DOMPurify sanitization rules
- **Icons**: [Lucide Icons](https://lucide.dev/)

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed on your machine (`curl -fsSL https://bun.sh/install | bash`)
- [Node.js](https://nodejs.org/) (optional, Bun is recommended)

### 1. Clone & Install

```bash
git clone https://github.com/KyuuX444/kyzz-temp.git
cd kyzz-temp
bun install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` according to your preferred configuration:

```ini
# Server Configuration
PORT=3000
HOST=0.0.0.0

# Mail Provider Selection: 'mailgw' | 'mailslurp' | 'webhook' | 'mock'
MAIL_PROVIDER=mailgw

# MailSlurp API Key (Only required if MAIL_PROVIDER=mailslurp)
# MAILSLURP_API_KEY=your_mailslurp_api_key_here

# Webhook Secret Token (Only required if MAIL_PROVIDER=webhook)
# WEBHOOK_SECRET=your_webhook_secret_here

# Rate Limiter Configuration (requests per minute per IP)
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_MS=60000
```

### 3. Run Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

```bash
bun run build
bun run preview
```

---

## 📡 REST API Documentation

Kyzz Temp provides clean REST API endpoints for external integrations:

### 1. Generate Mailbox
`POST /api/mailbox`

**Request Body (Optional for custom alias):**
```json
{
  "username": "customname",
  "domain": "example.com"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "mailbox": {
    "address": "customname@example.com",
    "token": "auth_token_here",
    "createdAt": "2026-09-13T21:00:00.000Z",
    "expiresAt": "2026-09-13T22:00:00.000Z"
  }
}
```

---

### 2. Fetch Inbox Messages
`GET /api/mailbox/:address/messages`

**Headers:**
`Authorization: Bearer <token>` (if required by provider)

**Response (`200 OK`):**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg_123",
      "from": { "name": "Google", "address": "no-reply@accounts.google.com" },
      "subject": "Security verification code: 492019",
      "intro": "Your verification code is 492019...",
      "createdAt": "2026-09-13T21:05:00.000Z",
      "isRead": false
    }
  ]
}
```

---

### 3. Read Single Email
`GET /api/mailbox/:address/messages/:id`

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": {
    "id": "msg_123",
    "from": { "name": "Google", "address": "no-reply@accounts.google.com" },
    "to": [{ "address": "user@domain.com" }],
    "subject": "Security verification code: 492019",
    "html": "<p>Your code is <b>492019</b></p>",
    "text": "Your code is 492019",
    "createdAt": "2026-09-13T21:05:00.000Z",
    "attachments": []
  }
}
```

---

### 4. Real-time Events Stream (SSE)
`GET /api/mailbox/:address/events`

Receives live updates whenever a new email arrives in the mailbox:
```text
event: connected
data: {"status":"connected","address":"user@domain.com"}

event: new_message
data: {"id":"msg_123","subject":"Welcome!","from":"service@mail.com"}
```

---

### 5. Inbound Webhook Endpoint
`POST /api/webhook/inbound`

Configurable endpoint to receive raw incoming emails from Cloudflare Workers, ImprovMX, or ForwardEmail.

---

## 📂 Project Structure

```text
kyzz-temp/
├── src/
│   ├── lib/
│   │   ├── components/       # Svelte UI Components (Navbar, Generator, Inbox, Viewer)
│   │   ├── server/
│   │   │   ├── mail/         # Multi-provider mail engines (MailGW, MailSlurp, Webhook)
│   │   │   └── security/     # HTML Sanitizer, Rate limiter, Security headers
│   │   ├── stores/           # Svelte 5 reactive stores
│   │   └── utils/            # Helper functions & formatters
│   ├── routes/
│   │   ├── api/              # REST Endpoints (Mailbox, Messages, SSE, Webhook)
│   │   ├── api-docs/         # Interactive API Documentation page
│   │   ├── faq/              # Frequently Asked Questions
│   │   ├── privacy/          # Privacy Policy
│   │   ├── +layout.svelte    # Global layout & toast container
│   │   └── +page.svelte      # Main application dashboard
├── static/                   # Favicons, Manifest & Service Workers
├── package.json
├── README.md
└── tsconfig.json
```

---

## 🔒 Security Best Practices

- All rendered email HTML content is sanitized using strict server-side rules preventing script execution and CSS-based phishing.
- Built-in In-Memory sliding-window rate limiting per IP.
- Zero persistent logging of confidential email contents.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

<div align="center">
  <b>Built with ❤️ by <a href="https://github.com/KyuuX444">KyuuX444</a></b>
</div>
