<div align="center">

# ⚡ KYZZ TEMP
### *Modern, Ultra-Fast & Minimalist Temporary Email Engine*

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge&logo=open-source-initiative&logoColor=white)](LICENSE)
[![SvelteKit](https://img.shields.io/badge/SvelteKit_2-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=for-the-badge&logo=pwa&logoColor=white)](#)

<p align="center">
  <b>Minimalist White Theme • Real-time SSE • Sandboxed Security • 5 Pluggable Mail Engines • Zero Logging</b>
</p>

```
  ┌──────────────────────────────────────────────────────────────┐
  │   📬  KYZZ TEMP INBOX :  swift.user8291@quickmail.dev        │
  │   🟢  STATUS          :  Live Server-Sent Events (SSE)       │
  │   ⏳  EXPIRATION      :  Self-destruct in 60 minutes          │
  └──────────────────────────────────────────────────────────────┘
```

</div>

---

## 📖 Daftar Isi
1. [Fitur Utama](#-fitur-utama)
2. [Persyaratan Sistem](#-persyaratan-sistem)
3. [Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
4. [Konfigurasi Environment (.env)](#-konfigurasi-environment-env)
5. [Panduan Setup 5 Provider Email](#-panduan-setup-5-provider-email)
6. [Menghubungkan Domain Sendiri](#-menghubungkan-domain-sendiri)
7. [Deploy ke Server / VPS](#-deploy-ke-server--vps)
8. [Dokumentasi REST API](#-dokumentasi-rest-api)
9. [Lisensi](#-lisensi)

---

## ✨ Fitur Utama

- ⚡ **Realtime Server-Sent Events (SSE)** — Notifikasi email masuk otomatis tanpa perlu reload atau polling berat.
- 🎨 **Clean Minimalist Design** — Tampilan modern, bersih (*white minimalist*), responsif di mobile & desktop, serta dark mode toggle.
- 🛡️ **Email Sandbox & Sanitizer** — Stripping script berbahaya, proteksi XSS (`sanitize-html`), dan link scanner.
- ⏱️ **Auto Self-Destruct** — Kotak masuk dan riwayat email otomatis terhapus setelah 60 menit.
- 🌐 **Side Domain Pool** — Ganti domain secara instan dalam 1-klik di samping inbox.
- 🔌 **5 Provider Engine Siap Pakai** — Mendukung Mail.gw, MailSlurp, Cloudflare Email Routing, ForwardEmail, dan ImprovMX.

---

## 💻 Persyaratan Sistem

- **Runtime**: [Bun](https://bun.sh) (v1.1+) atau Node.js (v20+)
- **OS**: Linux (Ubuntu/Debian/CentOS), macOS, atau Windows (WSL)

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Clone Repositori

```bash
git clone https://github.com/yourusername/kyzz-temp.git
cd kyzz-temp
```

### 2. Install Dependensi

Menggunakan Bun (Sangat Direkomendasikan):
```bash
bun install
```
*(Atau `npm install` jika menggunakan Node.js)*

### 3. Siapkan File `.env`

Salin contoh konfigurasi bawaan:
```bash
cp .env.example .env
```

### 4. Jalankan Mode Development

```bash
# Buka di localhost
bun run dev

# Atau buka ke jaringan lokal / LAN
bun run dev -- --host 0.0.0.0 --port 3000
```
Buka browser Anda di 👉 **http://localhost:3000**

---

## ⚙️ Konfigurasi Environment (`.env`)

Isi file [`.env`](.env) sesuai kebutuhan engine Anda:

```env
# Pilihan Provider: mailgw | mailslurp | cloudflare | forwardemail | improvmx | mock
MAIL_PROVIDER=mailgw

# Kredensial MailSlurp (hanya jika MAIL_PROVIDER=mailslurp)
MAIL_API_URL=https://api.mailslurp.com
MAIL_API_KEY=

# Daftar domain sendiri (pisahkan dengan koma jika lebih dari satu)
CUSTOM_DOMAINS=domainkamu.com,mail.domainkamu.com

# Pengaturan Aplikasi & Keamanan
APP_NAME=Kyzz Temp
APP_URL=http://localhost:3000
MAILBOX_LIFETIME_MINUTES=60
MAX_REQUESTS_PER_MINUTE=120
CORS_ALLOWED_ORIGINS=*
```

---

## 📬 Panduan Setup 5 Provider Email

### 1. Provider `mailgw` (100% Gratis & Otomatis)
Tidak memerlukan domain sendiri. Menggunakan API publik Mail.tm / Mail.gw yang otomatis menyediakan email gratis aktif.
- Set di `.env`: `MAIL_PROVIDER=mailgw`

### 2. Provider `cloudflare` (Domain Sendiri via Cloudflare Email Routing)
1. Aktifkan **Email Routing** di domain Cloudflare Anda.
2. Buat Rule **Catch-all** -> Kirim ke **Cloudflare Worker**.
3. Di Cloudflare Worker, teruskan payload email ke webhook aplikasi:
   ```javascript
   export default {
     async email(message, env, ctx) {
       const rawEmail = await new Response(message.raw).text();
       await fetch("https://domain-kamu.com/api/webhook/inbound", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           to: message.to,
           from: message.from,
           subject: message.headers.get("subject") || "(No Subject)",
           text: rawEmail
         })
       });
     }
   };
   ```
4. Set di `.env`:
   ```env
   MAIL_PROVIDER=cloudflare
   CUSTOM_DOMAINS=domainkamu.com
   ```

### 3. Provider `improvmx` (Forwarding Gratis 2-Menit)
1. Daftarkan domain di [ImprovMX.com](https://improvmx.com).
2. Tambahkan DNS MX records ke registrar domain Anda:
   - `MX priority 10 -> mx1.improvmx.com`
   - `MX priority 20 -> mx2.improvmx.com`
3. Masukkan Webhook URL di dashboard ImprovMX:
   `https://domain-kamu.com/api/webhook/inbound`
4. Set di `.env`:
   ```env
   MAIL_PROVIDER=improvmx
   CUSTOM_DOMAINS=domainkamu.com
   ```

### 4. Provider `forwardemail` (Open Source & Encrypted)
1. Tambahkan domain di [ForwardEmail.net](https://forwardemail.net).
2. Arahkan webhook masuk ke `https://domain-kamu.com/api/webhook/inbound`.
3. Set di `.env`:
   ```env
   MAIL_PROVIDER=forwardemail
   CUSTOM_DOMAINS=domainkamu.com
   ```

### 5. Provider `mock` (Pengujian Lokal / Simulator)
Menyediakan simulator email masuk otomatis (verifikasi GitHub & receipt Stripe) tanpa koneksi internet.
- Set di `.env`: `MAIL_PROVIDER=mock`

---

## 🌐 Menghubungkan Domain Sendiri ke Website

### Opsi A: Menggunakan Cloudflare Tunnel (Paling Mudah & Gratis SSL)
```bash
# 1. Install cloudflared di VPS
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# 2. Hubungkan ke port lokal 3000
cloudflared tunnel --url http://127.0.0.1:3000
```

### Opsi B: Menggunakan Nginx Reverse Proxy
Konfigurasi file `/etc/nginx/sites-available/tempmail`:
```nginx
server {
    server_name tempmail.domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Lalu pasang SSL gratis:
```bash
certbot --nginx -d tempmail.domainkamu.com
```

---

## 🚢 Deploy ke Server / VPS

### 1. Build Proyek Produksi
```bash
bun run build
```

### 2. Jalankan dengan PM2 (Background Daemon)
```bash
npm install -g pm2
pm2 start build/index.js --name "kyzz-temp" --env PORT=3000 HOST=0.0.0.0
pm2 save
pm2 startup
```

### 3. Perintah Standar Proyek
```bash
# Validasi Type & Svelte
bun run check

# Preview build produksi
bun run preview
```

---

## 🔌 Dokumentasi REST API

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/domains` | Mengambil daftar domain aktif |
| `POST` | `/api/mailbox` | Membuat kotak masuk email baru |
| `GET` | `/api/mailbox/:address` | Mengecek status & masa berlaku inbox |
| `GET` | `/api/mailbox/:address/messages` | Mengambil daftar email masuk |
| `GET` | `/api/mailbox/:address/messages/:id` | Mengambil isi & HTML email tersanitasi |
| `DELETE` | `/api/mailbox/:address` | Menghapus kotak masuk seketika |
| `POST` | `/api/webhook/inbound` | Endpoint Webhook penerima email masuk |

### Contoh Request Pembuatan Inbox (cURL)
```bash
curl -X POST http://localhost:3000/api/mailbox \
  -H "Content-Type: application/json" \
  -d '{"username": "tester", "domain": "domainkamu.com"}'
```

---

## 📄 Lisensi

Didistribusikan di bawah lisensi **MIT License**. Lihat file [`LICENSE`](LICENSE) untuk informasi lebih lanjut.

<div align="center">
  <sub>Developed with ❤️ for privacy and developer productivity.</sub>
</div>
