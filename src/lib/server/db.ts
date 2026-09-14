// src/lib/server/db.ts
// Cloudflare KV-backed storage helpers.
// In dev (vite dev), the bindings may be missing; we fall back to a local
// in-memory shim so the UI still works for local development.

import type { Mailbox, EmailMessageDetail } from '$lib/server/mail/types';

export interface MailPlatform {
	MAILBOX_STORE?: KVNamespace;
	RATE_LIMIT?: KVNamespace;
}

// ---------- In-memory fallback (dev / when KV not bound) ----------

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

// Shared dev-only fallback stores, so they survive across requests in the
// vite dev process but never leak into production.
const devMailStore = new MemoryKVImpl();
const devRateStore = new MemoryKVImpl();

// ---------- Public helpers ----------

function pickKV(platform: App.Platform | undefined, which: 'mail' | 'rate'): KVNamespace | MemoryKV {
	const env = platform?.env as MailPlatform | undefined;
	const binding = which === 'mail' ? env?.MAILBOX_STORE : env?.RATE_LIMIT;
	if (binding) return binding as KVNamespace;
	// Dev fallback
	return (which === 'mail' ? devMailStore : devRateStore) as unknown as KVNamespace;
}

export function getMailKV(platform: App.Platform | undefined): KVNamespace | MemoryKV {
	return pickKV(platform, 'mail');
}

export function getRateKV(platform: App.Platform | undefined): KVNamespace | MemoryKV {
	return pickKV(platform, 'rate');
}

// ---------- Mailbox storage ----------

const MAILBOX_KEY = (address: string) => `mb:${address.toLowerCase()}`;
const MESSAGES_KEY = (address: string) => `msgs:${address.toLowerCase()}`;
const MESSAGES_TTL_SECONDS = 24 * 60 * 60; // 1 day
const MAILBOX_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function putMailbox(platform: App.Platform | undefined, mb: Mailbox): Promise<void> {
	const kv = getMailKV(platform);
	await kv.put(MAILBOX_KEY(mb.address), JSON.stringify(mb), {
		expirationTtl: MAILBOX_TTL_SECONDS
	});
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
	await kv.put(key, JSON.stringify(trimmed), { expirationTtl: MESSAGES_TTL_SECONDS });
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
	const raw = await kv.get(MESSAGES_KEY(address));
	if (!raw) return false;
	const list: EmailMessageDetail[] = safeJsonArray(raw);
	const idx = list.findIndex((m) => m.id === messageId);
	if (idx === -1) return false;
	list.splice(idx, 1);
	await kv.put(MESSAGES_KEY(address), JSON.stringify(list), { expirationTtl: MESSAGES_TTL_SECONDS });
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
	await kv.put(MESSAGES_KEY(address), JSON.stringify(list), { expirationTtl: MESSAGES_TTL_SECONDS });
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
	const now = Math.floor(Date.now() / 1000);
	const raw = await kv.get(key);
	let entry: { count: number; resetTime: number } = { count: 0, resetTime: now + windowSec };

	if (raw) {
		try {
			entry = JSON.parse(raw);
		} catch {
			entry = { count: 0, resetTime: now + windowSec };
		}
	}

	if (entry.resetTime < now) {
		entry = { count: 0, resetTime: now + windowSec };
	}

	entry.count += 1;
	const allowed = entry.count <= maxRequests;
	const remaining = Math.max(0, maxRequests - entry.count);

	await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSec });

	return { allowed, remaining, resetTime: entry.resetTime };
}

// ---------- Utility: get platform from SvelteKit event ----------

export function getPlatformFromEvent(event: { platform?: App.Platform }): App.Platform | undefined {
	return event.platform;
}
