import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';

/**
 * GuerrillaMailProvider — public AJAX API (https://www.guerrillamail.com/).
 * Uses a per-session `sid_token` returned by `get_email_address`.
 * Domains rotate frequently; we list what the API returns at call time.
 */
export class GuerrillaMailProvider implements MailProvider {
	public readonly name = 'GuerrillaMail Public API';
	private readonly base = 'https://api.guerrillamail.com/ajax.php';
	private readonly tokens = new Map<string, string>(); // sid_token per address

	private async call<T>(params: Record<string, string>): Promise<T> {
		const qs = new URLSearchParams(params).toString();
		const res = await fetch(`${this.base}?${qs}`, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(8_000)
		});
		if (!res.ok) throw new Error(`Guerrilla ${res.status}`);
		return res.json() as Promise<T>;
	}

	private randomUser(): string {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let s = '';
		for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
		return s;
	}

	async getDomains(): Promise<DomainInfo[]> {
		// Guerrilla rotates between these per session — surface all as online.
		return ['guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la'].map((d) => ({
			domain: d,
			status: 'online',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		}));
	}

	async createMailbox(customUsername?: string, chosenDomain?: string): Promise<Mailbox> {
		interface CreateResp {
			email_addr: string;
			email_timestamp: number;
			sid_token: string;
			alias?: string;
		}
		const data = await this.call<CreateResp>({
			f: 'get_email_address',
			lang: 'en'
		});
		const address = data.email_addr.toLowerCase();
		this.tokens.set(address, data.sid_token);

		const now = new Date();
		return {
			id: 'mb_gm_' + Math.random().toString(36).slice(2, 9),
			address,
			domain: address.split('@')[1],
			createdAt: now.toISOString(),
			expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
			messageCount: 0
		};
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		// API doesn't have a "get mailbox by address" — return skeleton if it exists locally.
		const lower = address.toLowerCase();
		if (this.tokens.has(lower)) {
			return {
				id: 'mb_gm',
				address: lower,
				domain: lower.split('@')[1],
				createdAt: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 3600_000).toISOString(),
				messageCount: 0
			};
		}
		return null;
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return [];

		interface ListResp {
			mail_id: string;
			mail_from: string;
			mail_subject: string;
			mail_excerpt: string;
			mail_timestamp: number;
			mail_read: string;
			mail_size?: number;
		}
		interface Envelope {
			email_addr: string;
			mail_list?: ListResp[];
		}

		const env = await this.call<Envelope>({ f: 'get_email_list', sid_token: token, offset: '0' });
		const list = env.mail_list || [];
		return list.map((m) => ({
			id: m.mail_id,
			mailboxId: 'mb_gm',
			mailboxAddress: lower,
			from: { address: m.mail_from },
			to: [{ address: lower }],
			subject: m.mail_subject || '(No Subject)',
			preview: m.mail_excerpt || '',
			receivedAt: new Date((m.mail_timestamp || 0) * 1000).toISOString(),
			isRead: m.mail_read === '1',
			hasAttachments: false
		}));
	}

	async getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return null;

		interface FetchResp {
			mail_id: string;
			mail_from: string;
			subject: string;
			'mail_body'?: string;
			'mail_text'?: string;
			'mail_html'?: string;
			mail_timestamp: number;
		}
		const m = await this.call<FetchResp>({ f: 'fetch_email', sid_token: token, mail_id: messageId });
		const htmlBody = m['mail_html'] ?? '';
		const textBody = m['mail_text'] ?? m['mail_body'] ?? '';
		const richHtml = htmlBody || `<pre>${textBody}</pre>`;

		return {
			id: m.mail_id,
			mailboxId: 'mb_gm',
			mailboxAddress: lower,
			from: { address: m.mail_from },
			to: [{ address: lower }],
			subject: m.subject || '(No Subject)',
			preview: textBody.substring(0, 100),
			receivedAt: new Date((m.mail_timestamp || 0) * 1000).toISOString(),
			isRead: true,
			hasAttachments: false,
			textBody,
			htmlBody: richHtml,
			sanitizedHtml: sanitizeEmailHtml(richHtml),
			attachments: []
		};
	}

	async deleteMailbox(address: string): Promise<boolean> {
		const lower = address.toLowerCase();
		const token = this.tokens.get(lower);
		if (!token) return false;
		try {
			await this.call({ f: 'forget_me', sid_token: token });
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
			await this.call({ f: 'delete_email', sid_token: token, mail_id: messageId });
			return true;
		} catch {
			return false;
		}
	}
}
