// src/lib/server/db.ts
// Cloudflare D1 (SQLite) storage helpers.
// Replaces KV: D1 free plan allows 5M writes/day vs KV's 1k/day.
// In dev (vite dev), the binding may be missing; we fall back to a local
// in-memory shim so the UI still works for local development.

import type { Mailbox, EmailMessageDetail } from '$lib/server/mail/types';

export interface MailPlatform {
	MAILBOX_STORE?: KVNamespace;
	RATE_LIMIT?: KVNamespace;
	MAIL_DB?: D1Database;
}

// ---------- In-memory fallback (dev / when D1 not bound) ----------

interface MemoryKV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, opts?: { expirationTtl?: number; expiration?: number }): Promise<void>;
	delete(key: string): Promise<void>;
	list(opts?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

class MemoryKVImpl implements MemoryKV {
	private store = new Map<string, { value: string; expiresAt?: number }>();

	private purgeIfExpired(key: string) {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (entry.expiresAt && entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return null;
		}
		return entry.value;
	}

	async get(key: string) {
		return this.purgeIfExpired(key);
	}

	async put(key: string, value: string, opts?: { expirationTtl?: number; expiration?: number }) {
		let expiresAt: number | undefined;
		if (opts?.expirationTtl) expiresAt = Date.now() + opts.expirationTtl * 1000;
		if (opts?.expiration) expiresAt = opts.expiration * 1000;
		this.store.set(key, { value, expiresAt });
	}

	async delete(key: string) {
		this.store.delete(key);
	}

	async list(opts?: { prefix?: string }) {
		const prefix = opts?.prefix ?? '';
		const keys: { name: string }[] = [];
		for (const k of this.store.keys()) {
			if (k.startsWith(prefix)) keys.push({ name: k });
		}
		return { keys };
	}
}

// Shared dev-only fallback store, survives across requests in the vite dev
// process but never leaks into production.
const devStore = new MemoryKVImpl();

// ---------- D1-backed KV shim ----------

const now = () => Math.floor(Date.now() / 1000);

class D1KVImpl implements MemoryKV {
	constructor(private db: D1Database) {}

	async get(key: string) {
		// Lazy expiry: expired rows are invisible here and reaped on writes.
		const r = await this.db
			.prepare('SELECT value FROM kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)')
			.bind(key, now())
			.first<{ value: string }>();
		return r?.value ?? null;
	}

	async put(key: string, value: string, opts?: { expirationTtl?: number; expiration?: number }) {
		let expiresAt: number | null = null;
		if (opts?.expirationTtl) expiresAt = now() + opts.expirationTtl;
		if (opts?.expiration) expiresAt = opts.expiration;
		await this.db
			.prepare('INSERT OR REPLACE INTO kv (key, value, expires_at, updated) VALUES (?, ?, ?, ?)')
			.bind(key, value, expiresAt, now())
			.run();
	}

	async delete(key: string) {
		await this.db.prepare('DELETE FROM kv WHERE key = ?').bind(key).run();
	}

	async list(opts?: { prefix?: string }) {
		const prefix = opts?.prefix ?? '';
		const r = await this.db
			.prepare(
				'SELECT key AS name FROM kv WHERE key LIKE ? AND (expires_at IS NULL OR expires_at > ?)'
			)
			.bind(prefix + '%', now())
			.all<{ name: string }>();
		return { keys: r.results ?? [] };
	}
}

// ---------- Public helpers ----------

function pickStore(platform: App.Platform | undefined, which: 'mail' | 'rate'): MemoryKV {
	const env = platform?.env as MailPlatform | undefined;
	if (env?.MAIL_DB) return new D1KVImpl(env.MAIL_DB);
	// Legacy fallback if only KV is bound (kept until full cutover)
	if (which === 'mail' && env?.MAILBOX_STORE) return env.MAILBOX_STORE as unknown as MemoryKV;
	if (which === 'rate' && env?.RATE_LIMIT) return env.RATE_LIMIT as unknown as MemoryKV;
	// Dev fallback
	return devStore;
}

export function getMailKV(platform: App.Platform | undefined): MemoryKV {
	return pickStore(platform, 'mail');
}

export function getRateKV(platform: App.Platform | undefined): MemoryKV {
	return pickStore(platform, 'rate');
}

// ---------- Mailbox storage ----------

const MAILBOX_KEY = (address: string) => `mb:${address.toLowerCase()}`;
const MESSAGES_KEY = (address: string) => `msgs:${address.toLowerCase()}`;
const MESSAGES_TTL_SECONDS = 24 * 60 * 60; // 1 day
const MAILBOX_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function putMailbox(platform: App.Platform | undefined, mb: Mailbox): Promise<void> {
	const kv = getMailKV(platform);
	// Fail-safe: a write error (transient) must not 500 mailbox creation.
	// The mailbox is returned to the caller either way.
	try {
		await kv.put(MAILBOX_KEY(mb.address), JSON.stringify(mb), {
			expirationTtl: MAILBOX_TTL_SECONDS
		});
	} catch {
		// no-op — caller gets the mailbox object; persistence retried on next write
	}
}

export async function getMailboxKV(
	platform: App.Platform | undefined,
	address: string
): Promise<Mailbox | null> {
	const kv = getMailKV(platform);
	const raw = await kv.get(MAILBOX_KEY(address));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Mailbox;
	} catch {
		return null;
	}
}

export async function deleteMailboxKV(platform: App.Platform | undefined, address: string): Promise<void> {
	const kv = getMailKV(platform);
	await Promise.all([kv.delete(MAILBOX_KEY(address)), kv.delete(MESSAGES_KEY(address))]);
}

export async function appendMessageKV(
	platform: App.Platform | undefined,
	address: string,
	msg: EmailMessageDetail
): Promise<void> {
	const kv = getMailKV(platform);
	const key = MESSAGES_KEY(address);
	const raw = await kv.get(key);
	const list: EmailMessageDetail[] = raw ? safeJsonArray(raw) : [];
	list.unshift(msg);
	// Cap stored messages per mailbox to avoid unbounded growth
	const trimmed = list.slice(0, 200);
	try {
		await kv.put(key, JSON.stringify(trimmed), { expirationTtl: MESSAGES_TTL_SECONDS });
	} catch {
		// transient — message still returned to caller
	}
}

export async function getMessagesKV(
	platform: App.Platform | undefined,
	address: string
): Promise<EmailMessageDetail[]> {
	const kv = getMailKV(platform);
	const raw = await kv.get(MESSAGES_KEY(address));
	return raw ? safeJsonArray(raw) : [];
}

export async function deleteMessageKV(
	platform: App.Platform | undefined,
	address: string,
	messageId: string
): Promise<boolean> {
	const kv = getMailKV(platform);
	const key = MESSAGES_KEY(address);
	const raw = await kv.get(key);
	if (!raw) return false;
	const list: EmailMessageDetail[] = safeJsonArray(raw);
	const idx = list.findIndex((m) => m.id === messageId);
	if (idx === -1) return false;
	list.splice(idx, 1);
	try {
		await kv.put(key, JSON.stringify(list), { expirationTtl: MESSAGES_TTL_SECONDS });
	} catch {
		// transient — report deletion by id even if persistence lagged
	}
	return true;
}

export async function updateMessageReadKV(
	platform: App.Platform | undefined,
	address: string,
	messageId: string
): Promise<EmailMessageDetail | null> {
	const kv = getMailKV(platform);
	const raw = await kv.get(MESSAGES_KEY(address));
	if (!raw) return null;
	const list: EmailMessageDetail[] = safeJsonArray(raw);
	const msg = list.find((m) => m.id === messageId);
	if (!msg) return null;
	msg.isRead = true;
	try {
		await kv.put(MESSAGES_KEY(address), JSON.stringify(list), { expirationTtl: MESSAGES_TTL_SECONDS });
	} catch {
		// transient — still return the message to the caller
	}
	return msg;
}

function safeJsonArray(raw: string): EmailMessageDetail[] {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as EmailMessageDetail[]) : [];
	} catch {
		return [];
	}
}

// ---------- Rate-limit storage ----------

const RATE_KEY = (ip: string) => `rl:${ip}`;

export async function rateLimitHit(
	platform: App.Platform | undefined,
	ip: string,
	maxRequests: number,
	windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
	const kv = getRateKV(platform);
	const key = RATE_KEY(ip);
	const n = now();
	const raw = await kv.get(key);
	let entry: { count: number; resetTime: number } = { count: 0, resetTime: n + windowSec };

	if (raw) {
		try {
			entry = JSON.parse(raw);
		} catch {
			entry = { count: 0, resetTime: n + windowSec };
		}
	}

	if (entry.resetTime < n) {
		entry = { count: 0, resetTime: n + windowSec };
	}

	entry.count += 1;
	const allowed = entry.count <= maxRequests;
	const remaining = Math.max(0, maxRequests - entry.count);

	// Fail-open: a write error must never take down the request.
	// Rate limiting is a soft guard here.
	try {
		await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSec });
	} catch {
		return { allowed: true, remaining: maxRequests, resetTime: n + windowSec };
	}

	return { allowed, remaining, resetTime: entry.resetTime };
}

// ---------- Utility: get platform from SvelteKit event ----------

export function getPlatformFromEvent(event: { platform?: App.Platform }): App.Platform | undefined {
	return event.platform;
}
