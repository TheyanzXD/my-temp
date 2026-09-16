import type { MailProvider } from './types';
import { MockMailProvider } from './mock-provider';
import { MailSlurpProvider } from './mailslurp-provider';
import { MailGwProvider } from './mailgw-provider';
import { WebhookMailProvider } from './webhook-provider';

let cachedProvider: MailProvider | null = null;
let cachedProviderType: string | null = null;

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
				cachedProvider = new MailGwProvider();
				break;

			case 'mailslurp': {
				const apiKey = platform?.env?.MAIL_API_KEY;
				if (!apiKey) {
					console.warn('⚠️ MAIL_API_KEY is not set for mailslurp provider. Falling back to WebhookMailProvider.');
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
				cachedProvider = new WebhookMailProvider('Cloudflare Email Routing / Webhook', customDomains);
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
