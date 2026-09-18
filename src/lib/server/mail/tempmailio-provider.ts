import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';

/**
 * TempMailIoProvider — temp-mail.io internal API (https://temp-mail.io).
 * Free public endpoint, no auth, returns plain disposable address + token
 * used to poll messages.
 */
interface DomainEntry {
	name: string;
	type: string;
	forward_available: boolean;
	forward_max_seconds: number;
}

interface CreateEmailResp {
	email: string;
	token: string;
}

interface MessageEntry {
	id: string;
	from: string;
	to: string;
	subject?: string;
	'body-preview'?: string;
	'attachments-count'?: number;
	createdAt: string;
	readed?: boolean;
	html?: string;
	text?: string;
}

interface MessagesResp {
	messages: MessageEntry[];
	total?: number;
	'filter'?: string;
}

export class TempMailIoProvider implements MailProvider {
	public readonly name = 'Temp-Mail.io Public API';
	private readonly base = 'https://api.internal.temp-mail.io/api/v3';
	private readonly tokens = new Map<string, string>();
	private readonly ttlMs = 10 * 60 * 1000; // inbox lives 10 min by their policy

	private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await fetch(`${this.base}${path}`, {
			...init,
			headers: { Accept: 'application/json', ...(init.headers ?? {}) },
			signal: AbortSignal.timeout(8_000)
		});
		if (!res.ok) throw new Error(`Temp-mail.io ${res.status}`);
		return res.json() as Promise<T>;
	}

	private randomUser(): string {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let s = '';
		for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
		return s;
	}

	async getDomains(): Promise<DomainInfo[]> {
		try {
			const data = await this.call<{ domains: DomainEntry[] }>('/domains');
			return data.domains
				.filter((d) => d.type === 'public')
				.map((d) => ({
					domain: d.name,
					status: 'online',
					availability: d.forward_available,
					mxStatus: 'active',
					lastChecked: new Date().toISOString()
				}));
		} catch {
			return [];
		}
	}

	async createMailbox(customUsername?: string, chosenDomain?: string): Promise<Mailbox> {
		const username = customUsername ?? this.randomUser();
		const minLen = Math.max(username.length - 1, 6);
		const maxLen = username.length + 4;

		const body: Record<string, unknown> = { min_name_length: minLen, max_name_length: maxLen };
		if (chosenDomain) body.domain = chosenDomain;

		const data = await this.call<CreateEmailResp>('/email/new', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const address = data.email.toLowerCase();
		this.tokens.set(address, data.token);

		const now = new Date();
		return {
			id: 'mb_tmio_' + Math.random().toString(36).slice(2, 9),
			address,
			domain: address.split('@')[1],
			createdAt: now.toISOString(),
			expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
			messageCount: 0
		};
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return null;
		return {
			id: 'mb_tmio',
			address: lower,
			domain: lower.split('@')[1],
			createdAt: new Date().toISOString(),
			expiresAt: new Date(Date.now() + this.ttlMs).toISOString(),
			messageCount: 0
		};
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return [];

		try {
			const env = await this.call<MessagesResp>(`/email/${encodeURIComponent(lower)}/messages`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const list = env.messages || [];
			return list.map((m) => ({
				id: m.id,
				mailboxId: 'mb_tmio',
				mailboxAddress: lower,
				from: { address: m.from },
				to: [{ address: lower }],
				subject: m.subject || '(No Subject)',
				preview: m['body-preview'] || '',
				receivedAt: m.createdAt,
				isRead: !!m.readed,
				hasAttachments: (m['attachments-count'] || 0) > 0
			}));
		} catch {
			return [];
		}
	}

	async getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return null;

		try {
			const m = await this.call<MessageEntry>(
				`/email/${encodeURIComponent(lower)}/messages/${encodeURIComponent(messageId)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			);
			const textBody = m.text || m['body-preview'] || '';
			const htmlBody = m.html && m.html.length > 0 ? m.html : `<pre>${textBody}</pre>`;

			return {
				id: m.id,
				mailboxId: 'mb_tmio',
				mailboxAddress: lower,
				from: { address: m.from },
				to: [{ address: lower }],
				subject: m.subject || '(No Subject)',
				preview: (m['body-preview'] || '').substring(0, 100),
				receivedAt: m.createdAt,
				isRead: true,
				hasAttachments: (m['attachments-count'] || 0) > 0,
				textBody,
				htmlBody,
				sanitizedHtml: sanitizeEmailHtml(htmlBody),
				attachments: []
			};
		} catch {
			return null;
		}
	}

	async deleteMailbox(address: string): Promise<boolean> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return false;
		try {
			await this.call(`/email/${encodeURIComponent(lower)}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
		} catch {
			// ignore
		}
		this.tokens.delete(lower);
		return true;
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return false;
		try {
			await this.call(
				`/email/${encodeURIComponent(lower)}/messages/${encodeURIComponent(messageId)}`,
				{ method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
			);
			return true;
		} catch {
			return false;
		}
	}
}
