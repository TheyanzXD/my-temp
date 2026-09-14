import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';

export class MailGwProvider implements MailProvider {
	public readonly name = 'Mail.tm / Mail.gw API';
	private primaryUrl = 'https://api.mail.tm';
	private fallbackUrl = 'https://api.mail.gw';
	private tokens = new Map<string, string>();
	private mailboxIds = new Map<string, string>();
	private passwords = new Map<string, string>();

	private async request<T>(endpoint: string, options: RequestInit = {}, token?: string): Promise<T> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			...(options.headers as Record<string, string> || {})
		};

		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		const urls = [this.primaryUrl, this.fallbackUrl];
		let lastError: Error | null = null;

		for (const baseUrl of urls) {
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 6000);

				const res = await fetch(`${baseUrl}${endpoint}`, {
					...options,
					headers,
					signal: controller.signal
				});

				clearTimeout(timeout);

				if (res.ok) {
					return (await res.json()) as T;
				} else {
					const errorText = await res.text();
					lastError = new Error(`API ${baseUrl} HTTP ${res.status}: ${errorText}`);
				}
			} catch (err: unknown) {
				lastError = err instanceof Error ? err : new Error('Network error');
			}
		}

		throw lastError || new Error('All external mail endpoints down');
	}

	async getDomains(): Promise<DomainInfo[]> {
		try {
			interface MailGwDomain {
				id: string;
				domain: string;
				isActive: boolean;
			}
			interface DomainsResponse {
				'hydra:member': MailGwDomain[];
			}

			const data = await this.request<DomainsResponse>('/domains');
			const members = data['hydra:member'] || [];

			if (members.length > 0) {
				return members.map((d) => ({
					domain: d.domain,
					status: d.isActive ? 'online' : 'degraded',
					availability: d.isActive,
					mxStatus: 'active',
					lastChecked: new Date().toISOString()
				}));
			}
		} catch {
			// swallow
		}

		return [];
	}

	private async getAuthToken(address: string, password?: string): Promise<string> {
		const lower = address.toLowerCase();
		const cached = this.tokens.get(lower);
		if (cached) return cached;

		const pass = password || this.passwords.get(lower) || 'KyzzTemp#2026Secure';
		interface TokenResponse {
			token: string;
			id: string;
		}

		const data = await this.request<TokenResponse>('/token', {
			method: 'POST',
			body: JSON.stringify({ address: lower, password: pass })
		});

		this.tokens.set(lower, data.token);
		return data.token;
	}

	async createMailbox(customUsername?: string, chosenDomain?: string): Promise<Mailbox> {
		const domains = await this.getDomains();
		const activeDomains = domains.filter((d) => d.availability);
		const domain =
			chosenDomain && domains.some((d) => d.domain === chosenDomain)
				? chosenDomain
				: activeDomains[0]?.domain || 'uberip.com';

		let username = customUsername
			? customUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '')
			: '';

		if (!username) {
			const randNum = Math.floor(100000 + Math.random() * 900000);
			username = `user.${randNum}`;
		}

		const address = `${username}@${domain}`.toLowerCase();
		const password = 'KyzzTemp#' + Math.random().toString(36).substring(2, 10);
		this.passwords.set(address, password);

		interface CreateAccountResponse {
			id: string;
			address: string;
			createdAt: string;
		}

		const account = await this.request<CreateAccountResponse>('/accounts', {
			method: 'POST',
			body: JSON.stringify({ address, password })
		});

		this.mailboxIds.set(address, account.id);
		await this.getAuthToken(address, password);

		const now = new Date();
		const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

		return {
			id: account.id,
			address,
			domain,
			createdAt: account.createdAt || now.toISOString(),
			expiresAt,
			messageCount: 0
		};
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		const lower = address.toLowerCase();
		try {
			const token = await this.getAuthToken(lower);
			interface AccountDetail {
				id: string;
				address: string;
				createdAt: string;
			}
			const account = await this.request<AccountDetail>('/me', {}, token);

			return {
				id: account.id,
				address: account.address,
				domain: account.address.split('@')[1] || '',
				createdAt: account.createdAt,
				expiresAt: new Date(Date.now() + 3600000).toISOString(),
				messageCount: 0
			};
		} catch {
			return null;
		}
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		const lower = address.toLowerCase();
		try {
			const token = await this.getAuthToken(lower);
			interface MailGwMessage {
				id: string;
				accountId: string;
				from: { address: string; name?: string };
				to: Array<{ address: string; name?: string }>;
				subject: string;
				intro: string;
				seen: boolean;
				hasAttachments: boolean;
				createdAt: string;
			}
			interface MessagesResponse {
				'hydra:member': MailGwMessage[];
			}

			const data = await this.request<MessagesResponse>('/messages', {}, token);
			const members = data['hydra:member'] || [];

			return members.map((m) => ({
				id: m.id,
				mailboxId: m.accountId,
				mailboxAddress: lower,
				from: {
					name: m.from.name || m.from.address,
					address: m.from.address
				},
				to: m.to.map((t) => ({ name: t.name, address: t.address })),
				subject: m.subject || '(No Subject)',
				preview: m.intro || '',
				receivedAt: m.createdAt,
				isRead: m.seen,
				hasAttachments: m.hasAttachments || false
			}));
		} catch {
			return [];
		}
	}

	async getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null> {
		const lower = address.toLowerCase();
		try {
			const token = await this.getAuthToken(lower);
			interface MailGwMessageDetail {
				id: string;
				accountId: string;
				from: { address: string; name?: string };
				to: Array<{ address: string; name?: string }>;
				subject: string;
				intro: string;
				text: string;
				html: string[];
				hasAttachments: boolean;
				attachments?: Array<{ id: string; filename: string; contentType: string; size: number }>;
				createdAt: string;
			}

			const msg = await this.request<MailGwMessageDetail>(`/messages/${messageId}`, {}, token);
			const rawHtml = (msg.html && msg.html.length > 0 ? msg.html.join('') : '') || '';
			const isHtml = rawHtml.length > 0;
			const htmlBody = isHtml ? rawHtml : `<pre>${msg.text || msg.intro || ''}</pre>`;
			const textBody = msg.text || msg.intro || '';

			return {
				id: msg.id,
				mailboxId: msg.accountId,
				mailboxAddress: lower,
				from: {
					name: msg.from.name || msg.from.address,
					address: msg.from.address
				},
				to: msg.to.map((t) => ({ name: t.name, address: t.address })),
				subject: msg.subject || '(No Subject)',
				preview: msg.intro || textBody.substring(0, 100),
				receivedAt: msg.createdAt,
				isRead: true,
				hasAttachments: msg.hasAttachments || false,
				textBody,
				htmlBody,
				sanitizedHtml: sanitizeEmailHtml(htmlBody),
				attachments: (msg.attachments || []).map((a) => ({
					id: a.id,
					filename: a.filename,
					contentType: a.contentType,
					size: a.size
				}))
			};
		} catch {
			return null;
		}
	}

	async deleteMailbox(address: string): Promise<boolean> {
		const lower = address.toLowerCase();
		try {
			const token = await this.getAuthToken(lower);
			const id = this.mailboxIds.get(lower) || 'me';
			await this.request(`/accounts/${id}`, { method: 'DELETE' }, token);
			this.tokens.delete(lower);
			this.mailboxIds.delete(lower);
			this.passwords.delete(lower);
			return true;
		} catch {
			return false;
		}
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		const lower = address.toLowerCase();
		try {
			const token = await this.getAuthToken(lower);
			await this.request(`/messages/${messageId}`, { method: 'DELETE' }, token);
			return true;
		} catch {
			return false;
		}
	}
}
