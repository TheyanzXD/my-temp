import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';

export class MailSlurpProvider implements MailProvider {
	public readonly name = 'MailSlurp';
	private apiKey: string;
	private baseUrl: string;

	constructor(apiKey: string, baseUrl = 'https://api.mailslurp.com') {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl.replace(/\/$/, '');
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const res = await fetch(`${this.baseUrl}${endpoint}`, {
			...options,
			headers: {
				'x-api-key': this.apiKey,
				'Content-Type': 'application/json',
				...(options.headers || {})
			}
		});

		if (!res.ok) {
			const errorText = await res.text();
			throw new Error(`MailSlurp API Error (${res.status}): ${errorText}`);
		}

		return (await res.json()) as T;
	}

	async getDomains(): Promise<DomainInfo[]> {
		try {

			const domains = await this.request<Array<{ domain: string; isVerified: boolean }>>('/domains');
			return domains.map((d) => ({
				domain: d.domain,
				status: d.isVerified ? 'online' : 'degraded',
				availability: d.isVerified,
				mxStatus: 'active',
				lastChecked: new Date().toISOString()
			}));
		} catch {
			return [
				{
					domain: 'mailslurp.com',
					status: 'online',
					availability: true,
					mxStatus: 'active',
					lastChecked: new Date().toISOString()
				}
			];
		}
	}

	async createMailbox(customUsername?: string, domain?: string): Promise<Mailbox> {

		interface MailSlurpInbox {
			id: string;
			emailAddress: string;
			createdAt: string;
			expiresAt?: string;
		}

		const body: Record<string, unknown> = {};
		if (domain) body.domain = domain;
		if (customUsername) body.name = customUsername;

		const inbox = await this.request<MailSlurpInbox>('/inboxes', {
			method: 'POST',
			body: JSON.stringify(body)
		});

		const now = new Date();
		const expiresAt = inbox.expiresAt || new Date(now.getTime() + 60 * 60 * 1000).toISOString();

		return {
			id: inbox.id,
			address: inbox.emailAddress,
			domain: inbox.emailAddress.split('@')[1] || '',
			createdAt: inbox.createdAt || now.toISOString(),
			expiresAt,
			messageCount: 0
		};
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		try {
			interface MailSlurpInbox {
				id: string;
				emailAddress: string;
				createdAt: string;
				expiresAt?: string;
			}
			const inbox = await this.request<MailSlurpInbox>(`/inboxes/emailAddress/${encodeURIComponent(address)}`);
			if (!inbox) return null;

			return {
				id: inbox.id,
				address: inbox.emailAddress,
				domain: inbox.emailAddress.split('@')[1] || '',
				createdAt: inbox.createdAt,
				expiresAt: inbox.expiresAt || new Date(Date.now() + 3600000).toISOString(),
				messageCount: 0
			};
		} catch {
			return null;
		}
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		try {
			const mailbox = await this.getMailbox(address);
			if (!mailbox) return [];

			interface MailSlurpEmail {
				id: string;
				inboxId: string;
				from: string;
				to: string[];
				subject: string;
				createdAt: string;
				read: boolean;
				attachments?: string[];
			}

			const emails = await this.request<MailSlurpEmail[]>(`/inboxes/${mailbox.id}/emails`);

			return emails.map((e) => ({
				id: e.id,
				mailboxId: mailbox.id,
				mailboxAddress: address,
				from: {
					name: e.from,
					address: e.from
				},
				to: (e.to || []).map((t) => ({ address: t })),
				subject: e.subject || '(No Subject)',
				preview: e.subject || '',
				receivedAt: e.createdAt,
				isRead: e.read,
				hasAttachments: (e.attachments && e.attachments.length > 0) || false
			}));
		} catch {
			return [];
		}
	}

	async getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null> {
		try {
			interface MailSlurpEmailDetail {
				id: string;
				inboxId: string;
				from: string;
				to: string[];
				subject: string;
				body: string;
				createdAt: string;
				isHTML: boolean;
				read: boolean;
				attachments?: Array<{ id: string; name: string; contentType: string; sizeBytes: number }>;
			}

			const email = await this.request<MailSlurpEmailDetail>(`/emails/${messageId}`);
			if (!email) return null;

			const isHtml = email.isHTML || /<[a-z][\s\S]*>/i.test(email.body || '');
			const htmlBody = isHtml ? email.body : `<pre>${email.body}</pre>`;
			const textBody = isHtml ? email.body.replace(/<[^>]*>/g, '') : email.body;

			return {
				id: email.id,
				mailboxId: email.inboxId,
				mailboxAddress: address,
				from: {
					name: email.from,
					address: email.from
				},
				to: (email.to || []).map((t) => ({ address: t })),
				subject: email.subject || '(No Subject)',
				preview: textBody.substring(0, 100),
				receivedAt: email.createdAt,
				isRead: true,
				hasAttachments: (email.attachments && email.attachments.length > 0) || false,
				textBody,
				htmlBody,
				sanitizedHtml: sanitizeEmailHtml(htmlBody),
				attachments: (email.attachments || []).map((a) => ({
					id: a.id,
					filename: a.name,
					contentType: a.contentType,
					size: a.sizeBytes
				}))
			};
		} catch {
			return null;
		}
	}

	async deleteMailbox(address: string): Promise<boolean> {
		try {
			const mailbox = await this.getMailbox(address);
			if (!mailbox) return false;
			await this.request(`/inboxes/${mailbox.id}`, { method: 'DELETE' });
			return true;
		} catch {
			return false;
		}
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		try {
			await this.request(`/emails/${messageId}`, { method: 'DELETE' });
			return true;
		} catch {
			return false;
		}
	}
}
