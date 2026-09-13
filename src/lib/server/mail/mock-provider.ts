import type {
	DomainInfo,
	Mailbox,
	EmailMessageSummary,
	EmailMessageDetail,
	MailProvider
} from './types';
import { sanitizeEmailHtml } from '../security';

export class MockMailProvider implements MailProvider {
	public readonly name = 'MockMailProvider (Full Interactive Engine)';

	private domains: DomainInfo[] = [
		{
			domain: 'tempinbox.org',
			status: 'online',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		},
		{
			domain: 'quickmail.dev',
			status: 'online',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		},
		{
			domain: 'disposafast.io',
			status: 'online',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		},
		{
			domain: 'mailprivy.net',
			status: 'online',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		},
		{
			domain: 'vaultbox.cc',
			status: 'degraded',
			availability: true,
			mxStatus: 'active',
			lastChecked: new Date().toISOString()
		}
	];

	private mailboxes = new Map<string, Mailbox>();
	private messages = new Map<string, EmailMessageDetail[]>();

	constructor() {
		if (typeof setInterval !== 'undefined') {
			setInterval(() => this.cleanupExpiredMailboxes(), 5 * 60 * 1000);
		}
	}

	private cleanupExpiredMailboxes() {
		const now = Date.now();
		for (const [address, mb] of this.mailboxes.entries()) {
			if (new Date(mb.expiresAt).getTime() < now) {
				this.mailboxes.delete(address);
				this.messages.delete(address);
			}
		}
	}

	async getDomains(): Promise<DomainInfo[]> {
		return [...this.domains];
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

		this.mailboxes.set(address, mailbox);
		this.messages.set(address, []);


		this.scheduleSampleEmails(address, username);

		return mailbox;
	}

	private addIncomingMessage(address: string, msg: Omit<EmailMessageDetail, 'id' | 'mailboxId' | 'mailboxAddress' | 'receivedAt'>) {
		if (!this.mailboxes.has(address)) return;

		const detail: EmailMessageDetail = {
			id: 'msg_' + Math.random().toString(36).substring(2, 11),
			mailboxId: this.mailboxes.get(address)?.id || '',
			mailboxAddress: address,
			receivedAt: new Date().toISOString(),
			...msg
		};

		const list = this.messages.get(address) || [];
		list.unshift(detail);
		this.messages.set(address, list);

		const mb = this.mailboxes.get(address);
		if (mb) {
			mb.messageCount = list.length;
		}
	}

	private scheduleSampleEmails(address: string, username: string) {

		setTimeout(() => {
			const code = Math.floor(100000 + Math.random() * 900000);
			const html = `
				<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7;">
					<div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 16px; margin-bottom: 20px;">
						<h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #09090b;">GitHub Security</h2>
					</div>
					<p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Hi <strong>${username}</strong>,</p>
					<p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Please use the following verification code to confirm your email address and complete your sign-in attempt:</p>
					<div style="background-color: #f4f4f5; padding: 18px 24px; border-radius: 6px; text-align: center; margin: 24px 0; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #09090b; font-family: monospace;">
						${code}
					</div>
					<p style="font-size: 14px; line-height: 1.5; color: #71717a;">This verification code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.</p>
					<hr style="border: none; border-top: 1px solid #f4f4f5; margin: 24px 0;" />
					<p style="font-size: 12px; color: #a1a1aa; margin: 0;">Sent automatically by GitHub Security Team • Protect your account</p>
				</div>
			`;
			this.addIncomingMessage(address, {
				from: { name: 'GitHub Security', address: 'noreply@github.com' },
				to: [{ address }],
				subject: `${code} is your GitHub verification code`,
				preview: `Please use the following verification code to complete your login: ${code}...`,
				isRead: false,
				hasAttachments: false,
				textBody: `Hi ${username},\nYour verification code is: ${code}`,
				htmlBody: html,
				sanitizedHtml: sanitizeEmailHtml(html),
				attachments: []
			});
		}, 1500);


		setTimeout(() => {
			const invoiceId = 'inv_' + Math.random().toString(36).substring(2, 9).toUpperCase();
			const html = `
				<div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 540px; border: 1px solid #eee; border-radius: 8px;">
					<h3 style="color: #6366f1; margin-top: 0;">Payment Confirmation</h3>
					<p>Thank you for your subscription! Your receipt <strong>#${invoiceId}</strong> has been generated.</p>
					<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
						<tr style="border-bottom: 1px solid #ddd;">
							<td style="padding: 8px 0;">Pro Plan (Monthly)</td>
							<td style="text-align: right; padding: 8px 0;">$0.00 (Trial)</td>
						</tr>
					</table>
					<p style="font-size: 12px; color: #888;">Manage your billing preferences anytime in your account dashboard.</p>
				</div>
			`;
			this.addIncomingMessage(address, {
				from: { name: 'Stripe Billing', address: 'receipts@stripe.com' },
				to: [{ address }],
				subject: `Receipt #${invoiceId} for your subscription`,
				preview: `Thank you for your payment. Your receipt #${invoiceId} is available for download...`,
				isRead: false,
				hasAttachments: true,
				textBody: `Your receipt #${invoiceId} is ready.`,
				htmlBody: html,
				sanitizedHtml: sanitizeEmailHtml(html),
				attachments: [
					{
						id: 'att_1',
						filename: `receipt-${invoiceId}.pdf`,
						contentType: 'application/pdf',
						size: 24500
					}
				]
			});
		}, 12000);
	}

	async getMailbox(address: string): Promise<Mailbox | null> {
		const lower = address.toLowerCase();
		const mb = this.mailboxes.get(lower);
		if (!mb) return null;

		if (new Date(mb.expiresAt).getTime() < Date.now()) {
			this.mailboxes.delete(lower);
			this.messages.delete(lower);
			return null;
		}

		return { ...mb };
	}

	async getMessages(address: string): Promise<EmailMessageSummary[]> {
		const lower = address.toLowerCase();
		const list = this.messages.get(lower);
		if (!list) return [];

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
		const list = this.messages.get(lower);
		if (!list) return null;

		const msg = list.find((m) => m.id === messageId);
		if (!msg) return null;

		msg.isRead = true;
		return { ...msg };
	}

	async deleteMailbox(address: string): Promise<boolean> {
		const lower = address.toLowerCase();
		this.mailboxes.delete(lower);
		this.messages.delete(lower);
		return true;
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		const lower = address.toLowerCase();
		const list = this.messages.get(lower);
		if (!list) return false;

		const index = list.findIndex((m) => m.id === messageId);
		if (index === -1) return false;

		list.splice(index, 1);
		const mb = this.mailboxes.get(lower);
		if (mb) {
			mb.messageCount = list.length;
		}
		return true;
	}
}
