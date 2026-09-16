import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';
import {
	putMailbox,
	getMailboxKV,
	appendMessageKV,
	getMessagesKV,
	deleteMailboxKV,
	deleteMessageKV,
	updateMessageReadKV
} from '../db';

/**
 * WebhookMailProvider — store mailboxes + messages in Cloudflare KV so they
 * survive across requests/isolates. Use with MAIL_PROVIDER=webhook and
 * CUSTOM_DOMAINS=yaoi.my.id (or any domain you own that is wired into
 * Cloudflare Email Routing, ImprovMX, or ForwardEmail).
 */
export class WebhookMailProvider implements MailProvider {
	public readonly name: string;
	private customDomains: string[];

	constructor(
		name = 'Webhook Provider (Cloudflare / ForwardEmail / ImprovMX)',
		domains: string[] = ['yaoi.my.id']
	) {
		this.name = name;
		this.customDomains = domains;
	}

	// Each provider call receives the SvelteKit platform so we can access KV.
	private platform: App.Platform | undefined;

	bind(platform: App.Platform | undefined) {
		this.platform = platform;
	}

	setDomains(domains: string[]) {
		if (domains && domains.length > 0) {
			this.customDomains = domains;
		}
	}

	async getDomains(): Promise<DomainInfo[]> {
		return this.customDomains.map((domain) => ({
			domain,
			status: 'online',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		}));
	}

	async createMailbox(customUsername?: string, chosenDomain?: string): Promise<Mailbox> {
		const domain = chosenDomain || this.customDomains[0] || 'yaoi.my.id';
		let username = customUsername
			? customUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '')
			: '';

		if (!username) {
			const adjectives = ['swift', 'silent', 'nova', 'cipher', 'echo', 'shadow', 'frost', 'pixel', 'vortex', 'blaze'];
			const nouns = ['fox', 'raven', 'falcon', 'nebula', 'spark', 'drift', 'ghost', 'prism', 'pulse', 'orbit'];
			const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
			const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
			const randNum = Math.floor(1000 + Math.random() * 9000);
			username = `${randAdj}.${randNoun}${randNum}`;
		}

		const address = `${username}@${domain}`.toLowerCase();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

		const mailbox: Mailbox = {
			id: 'mb_hook_' + Math.random().toString(36).substring(2, 9),
			address,
			domain,
			createdAt: now.toISOString(),
			expiresAt,
			messageCount: 0
		};

		await putMailbox(this.platform, mailbox);
		return mailbox;
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		return getMailboxKV(this.platform, address);
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		const list = await getMessagesKV(this.platform, address);
		return list.map((m) => ({
			id: m.id,
			mailboxId: m.mailboxId,
			mailboxAddress: m.mailboxAddress,
			from: m.from,
			to: m.to,
			subject: m.subject,
			preview: m.preview,
			receivedAt: m.receivedAt,
			isRead: m.isRead,
			hasAttachments: m.hasAttachments
		}));
	}

	async getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null> {
		return updateMessageReadKV(this.platform, address, messageId);
	}

	async deleteMailbox(address: string): Promise<boolean> {
		await deleteMailboxKV(this.platform, address);
		return true;
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		return deleteMessageKV(this.platform, address, messageId);
	}
}

/**
 * Helper used by the inbound webhook endpoint. Stores the message in KV
 * associated with the recipient mailbox (auto-creates a mailbox record on
 * the fly so newly-received mail shows up before the user opens the UI).
 */
export async function receiveInboundWebhookEmail(
	platform: App.Platform | undefined,
	data: {
		to: string;
		from: string;
		fromName?: string;
		subject: string;
		text?: string;
		html?: string;
	}
): Promise<EmailMessageDetail> {
	// Normalize email address: extract plain email if format is "Name <email@domain>"
	let rawTo = data.to.trim();
	const emailMatch = rawTo.match(/<([^>]+)>/) || rawTo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
	const address = (emailMatch ? emailMatch[1] : rawTo).toLowerCase().trim();

	let rawFrom = data.from.trim();
	const fromMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
	const fromAddress = (fromMatch ? fromMatch[1] : rawFrom).toLowerCase().trim();
	const fromName = data.fromName || rawFrom.replace(/<[^>]+>/, '').trim() || fromAddress;

	// Auto-create mailbox if missing
	let mb = await getMailboxKV(platform, address);
	if (!mb) {
		const domain = address.split('@')[1] || 'yaoi.my.id';
		mb = {
			id: 'mb_inbound_' + Math.random().toString(36).substring(2, 9),
			address,
			domain,
			createdAt: new Date().toISOString(),
			expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			messageCount: 0
		};
		await putMailbox(platform, mb);
	}

	const rawHtml = data.html || (data.text ? `<pre>${data.text}</pre>` : '');
	const textBody = data.text || data.html?.replace(/<[^>]*>/g, '') || '';

	const newMsg: EmailMessageDetail = {
		id: 'msg_inbound_' + Math.random().toString(36).substring(2, 10),
		mailboxId: mb.id,
		mailboxAddress: address,
		from: {
			name: fromName,
			address: fromAddress
		},
		to: [{ address }],
		subject: data.subject || '(No Subject)',
		preview: textBody.substring(0, 100),
		receivedAt: new Date().toISOString(),
		isRead: false,
		hasAttachments: false,
		textBody,
		htmlBody: rawHtml,
		sanitizedHtml: sanitizeEmailHtml(rawHtml),
		attachments: []
	};

	await appendMessageKV(platform, address, newMsg);
	return newMsg;
}
