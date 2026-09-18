import type { MailProvider } from './types';
import { MockMailProvider } from './mock-provider';
import { MailSlurpProvider } from './mailslurp-provider';
import { MailGwProvider } from './mailgw-provider';
import { WebhookMailProvider } from './webhook-provider';
import { GuerrillaMailProvider } from './guerrilla-provider';
import { TempMailIoProvider } from './tempmailio-provider';
import { CompositeProvider } from './composite-provider';

let cachedProvider: MailProvider | null = null;
let cachedProviderType: string | null = null;

/**
 * FiveProviderAuto — picks among 5 providers on a per-minute rotating cursor.
 * Order:
 *   1. mail.tm / mail.gw (jwt, official public API, docs at docs.mail.tm)
 *   2. temp-mail.io internal API v3 (instant token, 7+ public domains)
 *   3. GuerrillaMail (sid_token, multi-domain rotate)
 *   4. Composite (3-way auto-fallback chain)
 *   5. MockMail (KV-backed deterministic seed; never fails)
 *
 * Set MAIL_PROVIDER=five to enable.
 */
const FIVE_INTERNAL_ROTATORS: MailProvider[] = [
	new MailGwProvider(),
	new TempMailIoProvider(),
	new GuerrillaMailProvider(),
	new CompositeProvider(),
	new MockMailProvider()
];

class FiveProviderAuto implements MailProvider {
	readonly name = 'Five-Provider Auto-Rotator (mail.tm · temp-mail.io · Guerrilla · Composite · Mock)';

	async getDomains() {
		const seen = new Set<string>();
		const out: import('./types').DomainInfo[] = [];
		for (const p of FIVE_INTERNAL_ROTATORS) {
			try {
				for (const d of await p.getDomains()) {
					if (!seen.has(d.domain)) {
						seen.add(d.domain);
						out.push(d);
					}
				}
			} catch {
				/* skip */
			}
		}
		return out;
	}

	private currentIdx(): number {
		// Bucket by minute so caller gets stable provider within a window,
		// rotates every minute so we hit quota across providers evenly.
		const minute = Math.floor(Date.now() / 60_000);
		return minute % FIVE_INTERNAL_ROTATORS.length;
	}

	async createMailbox(customUsername?: string, domain?: string) {
		const errors: unknown[] = [];
		for (let i = 0; i < FIVE_INTERNAL_ROTATORS.length; i++) {
			const idx = (this.currentIdx() + i) % FIVE_INTERNAL_ROTATORS.length;
			try {
				return await FIVE_INTERNAL_ROTATORS[idx].createMailbox(customUsername, domain);
			} catch (e) {
				errors.push(e);
			}
		}
		throw new Error(
			`All 5 providers failed: ${errors
				.map((e) => (e instanceof Error ? e.message : String(e)))
				.join('; ')}`
		);
	}

	async getMailbox(address: string) {
		for (const p of FIVE_INTERNAL_ROTATORS) {
			try {
				const m = await p.getMailbox(address);
				if (m) return m;
			} catch {
				/* skip */
			}
		}
		return null;
	}

	async getMessages(address: string) {
		for (const p of FIVE_INTERNAL_ROTATORS) {
			try {
				const m = await p.getMessages(address);
				if (m.length > 0) return m;
			} catch {
				/* skip */
			}
		}
		return [];
	}

	async getMessage(address: string, messageId: string) {
		for (const p of FIVE_INTERNAL_ROTATORS) {
			try {
				const m = await p.getMessage(address, messageId);
				if (m) return m;
			} catch {
				/* skip */
			}
		}
		return null;
	}

	async deleteMailbox(address: string) {
		let any = false;
		for (const p of FIVE_INTERNAL_ROTATORS) {
			try {
				if (await p.deleteMailbox(address)) any = true;
			} catch {
				/* skip */
			}
		}
		return any;
	}

	async deleteMessage(address: string, messageId: string) {
		let any = false;
		for (const p of FIVE_INTERNAL_ROTATORS) {
			try {
				if (await p.deleteMessage(address, messageId)) any = true;
			} catch {
				/* skip */
			}
		}
		return any;
	}
}

export function getMailProvider(platform?: App.Platform): MailProvider {
	const providerType = (platform?.env?.MAIL_PROVIDER || 'webhook').toLowerCase();
	const customDomains = (platform?.env?.CUSTOM_DOMAINS || 'yaoi.web.id')
		.split(',')
		.map((d) => d.trim())
		.filter(Boolean);

	if (!cachedProvider || cachedProviderType !== providerType) {
		cachedProviderType = providerType;

		switch (providerType) {
			case 'mailgw':
			case 'mailtm':
			case 'mailtm-gw':
				cachedProvider = new MailGwProvider();
				break;

			case 'tempmailio':
			case 'temp-mail.io':
			case 'temp_mail_io':
				cachedProvider = new TempMailIoProvider();
				break;

			case 'guerrilla':
			case 'guerrillamail':
				cachedProvider = new GuerrillaMailProvider();
				break;

			case 'composite':
				cachedProvider = new CompositeProvider();
				break;

			case 'five':
			case 'auto5':
			case 'five-auto':
				cachedProvider = new FiveProviderAuto();
				break;

			case 'mailslurp': {
				const apiKey = platform?.env?.MAIL_API_KEY;
				if (!apiKey) {
					console.warn(
						'⚠️ MAIL_API_KEY is not set for mailslurp provider. Falling back to WebhookMailProvider.'
					);
					cachedProvider = new WebhookMailProvider('Webhook (mailslurp fallback)', customDomains);
				} else {
					cachedProvider = new MailSlurpProvider(apiKey, platform?.env?.MAIL_API_URL);
				}
				break;
			}

			case 'cloudflare':
			case 'cloudflare_workers':
			case 'webhook':
			case 'improvmx':
			case 'forwardemail':
				cachedProvider = new WebhookMailProvider(
					'Cloudflare Email Routing / Webhook',
					customDomains
				);
				break;

			case 'mock':
			default:
				cachedProvider = new MockMailProvider();
				break;
		}
	}

	// Per-call: bind platform and update domains so KV-backed providers stay current
	const maybeBind = cachedProvider as unknown as {
		bind?: (p: App.Platform | undefined) => void;
		setDomains?: (d: string[]) => void;
	};
	if (typeof maybeBind.bind === 'function') {
		maybeBind.bind(platform);
	}
	if (typeof maybeBind.setDomains === 'function' && customDomains.length > 0) {
		maybeBind.setDomains(customDomains);
	}

	return cachedProvider;
}
