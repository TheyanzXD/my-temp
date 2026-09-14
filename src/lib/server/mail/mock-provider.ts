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
 * MockMailProvider — uses Cloudflare KV (or dev memory shim) to persist a
 * handful of demo domains and the seeded sample emails per mailbox.
 * No external network calls; safe for first-deploy demos.
 */
export class MockMailProvider implements MailProvider {
	public readonly name = 'MockMailProvider (KV-backed)';

	private domains: DomainInfo[] = [
		{ domain: 'tempinbox.org', status: 'online', availability: true, mxStatus: 'active', lastChecked: new Date().toISOString() },
		{ domain: 'quickmail.dev', status: 'online', availability: true, mxStatus: 'active', lastChecked: new Date().toISOString() },
		{ domain: 'disposafast.io', status: 'online', availability: true, mxStatus: 'active', lastChecked: new Date().toISOString() },
		{ domain: 'mailprivy.net', status: 'online', availability: true, mxStatus: 'active', lastChecked: new Date().toISOString() },
		{ domain: 'vaultbox.cc', status: 'degraded', availability: true, mxStatus: 'active', lastChecked: new Date().toISOString() }
	];

	private platform: App.Platform | undefined;
	bind(platform: App.Platform | undefined) {
		this.platform = platform;
	}

	async getDomains(): Promise<DomainInfo[]> {
		// Mark them fresh on each call so timestamps stay recent
		const now = new Date().toISOString();
		return this.domains.map((d) => ({ ...d, lastChecked: now }));
	}

	async createMailbox(customUsername?: string, chosenDomain?: string): Promise<Mailbox> {
		const activeDomains = this.domains.filter((d) => d.availability && d.status !== 'offline');
		const domain =
			chosenDomain && this.domains.some((d) => d.domain === chosenDomain)
				? chosenDomain
				: activeDomains[Math.floor(Math.random() * activeDomains.length)]?.domain || 'tempinbox.org';

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
		const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

		const mailbox: Mailbox = {
			id: 'mb_' + Math.random().toString(36).substring(2, 11),
			address,
			domain,
			createdAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			messageCount: 0
		};

		await putMailbox(this.platform, mailbox);

		// Seed two sample messages for instant UI demo. Done as a "best-effort"
		// background fire-and-forget — errors don't fail mailbox creation.
		void this.seedSampleMessages(address, username);

		return mailbox;
	}

	private async seedSampleMessages(address: string, username: string) {
		// Message 1 — GitHub-style verification code
		const code = Math.floor(100000 + Math.random() * 900000);
		const html1 = `
			<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7;">
				<div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 16px; margin-bottom: 20px;">
					<h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #09090b;">GitHub Security</h2>
				</div>
				<p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Hi <strong>${username}</strong>,</p>
				<p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Please use the following verification code to confirm your email address:</p>
				<div style="background-color: #f4f4f5; padding: 18px 24px; border-radius: 6px; text-align: center; margin: 24px 0; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #09090b; font-family: monospace;">${code}</div>
				<p style="font-size: 14px; line-height: 1.5; color: #71717a;">This verification code will expire in 10 minutes.</p>
			</div>
		`;
		await appendMessageKV(this.platform, address, {
			id: 'msg_seed1_' + Math.random().toString(36).substring(2, 9),
			mailboxId: '',
			mailboxAddress: address,
			from: { name: 'GitHub Security', address: 'noreply@github.com' },
			to: [{ address }],
			subject: `${code} is your GitHub verification code`,
			preview: `Please use the following verification code to complete your login: ${code}...`,
			receivedAt: new Date().toISOString(),
			isRead: false,
			hasAttachments: false,
			textBody: `Hi ${username},\nYour verification code is: ${code}`,
			htmlBody: html1,
			sanitizedHtml: sanitizeEmailHtml(html1),
			attachments: []
		});

		// Message 2 — Stripe-style receipt
		const invoiceId = 'inv_' + Math.random().toString(36).substring(2, 9).toUpperCase();
		const html2 = `
			<div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 540px; border: 1px solid #eee; border-radius: 8px;">
				<h3 style="color: #6366f1; margin-top: 0;">Payment Confirmation</h3>
				<p>Thank you for your subscription! Your receipt <strong>#${invoiceId}</strong> has been generated.</p>
			</div>
		`;
		await appendMessageKV(this.platform, address, {
			id: 'msg_seed2_' + Math.random().toString(36).substring(2, 9),
			mailboxId: '',
			mailboxAddress: address,
			from: { name: 'Stripe Billing', address: 'receipts@stripe.com' },
			to: [{ address }],
			subject: `Receipt #${invoiceId} for your subscription`,
			preview: `Thank you for your payment. Your receipt #${invoiceId} is available for download...`,
			receivedAt: new Date().toISOString(),
			isRead: false,
			hasAttachments: true,
			textBody: `Your receipt #${invoiceId} is ready.`,
			htmlBody: html2,
			sanitizedHtml: sanitizeEmailHtml(html2),
			attachments: [{ id: 'att_1', filename: `receipt-${invoiceId}.pdf`, contentType: 'application/pdf', size: 24500 }]
		});
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		const mb = await getMailboxKV(this.platform, address);
		if (!mb) return null;
		if (new Date(mb.expiresAt).getTime() < Date.now()) {
			await deleteMailboxKV(this.platform, address);
			return null;
		}
		return { ...mb };
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
