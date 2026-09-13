import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';


export const webhookEmailStore = new Map<string, EmailMessageDetail[]>();
export const webhookMailboxStore = new Map<string, Mailbox>();

export class WebhookMailProvider implements MailProvider {
	public readonly name: string;
	private customDomains: string[];

	constructor(name = 'Webhook Provider (Cloudflare / ForwardEmail / ImprovMX)', domains: string[] = ['mycustomdomain.com']) {
		this.name = name;
		this.customDomains = domains;
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
		const domain = chosenDomain || this.customDomains[0] || 'mycustomdomain.com';
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

		webhookMailboxStore.set(address, mailbox);
		if (!webhookEmailStore.has(address)) {
			webhookEmailStore.set(address, []);
		}

		return mailbox;
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		const lower = address.toLowerCase();
		return webhookMailboxStore.get(lower) || null;
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		const lower = address.toLowerCase();
		const list = webhookEmailStore.get(lower) || [];

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
		const lower = address.toLowerCase();
		const list = webhookEmailStore.get(lower) || [];
		const msg = list.find((m) => m.id === messageId);
		if (!msg) return null;
		msg.isRead = true;
		return { ...msg };
	}

	async deleteMailbox(address: string): Promise<boolean> {
		const lower = address.toLowerCase();
		webhookMailboxStore.delete(lower);
		webhookEmailStore.delete(lower);
		return true;
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		const lower = address.toLowerCase();
		const list = webhookEmailStore.get(lower) || [];
		const idx = list.findIndex((m) => m.id === messageId);
		if (idx === -1) return false;
		list.splice(idx, 1);
		const mb = webhookMailboxStore.get(lower);
		if (mb) mb.messageCount = list.length;
		return true;
	}
}


export function receiveInboundWebhookEmail(data: {
	to: string;
	from: string;
	fromName?: string;
	subject: string;
	text?: string;
	html?: string;
}) {
	const address = data.to.toLowerCase().trim();
	const list = webhookEmailStore.get(address) || [];

	const rawHtml = data.html || (data.text ? `<pre>${data.text}</pre>` : '');
	const textBody = data.text || data.html?.replace(/<[^>]*>/g, '') || '';

	const newMsg: EmailMessageDetail = {
		id: 'msg_inbound_' + Math.random().toString(36).substring(2, 10),
		mailboxId: webhookMailboxStore.get(address)?.id || 'mb_inbound',
		mailboxAddress: address,
		from: {
			name: data.fromName || data.from,
			address: data.from
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

	list.unshift(newMsg);
	webhookEmailStore.set(address, list);

	const mb = webhookMailboxStore.get(address);
	if (mb) {
		mb.messageCount = list.length;
	}

	return newMsg;
}
