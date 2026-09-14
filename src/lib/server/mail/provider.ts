import type { MailProvider } from './types';
import { MockMailProvider } from './mock-provider';
import { MailSlurpProvider } from './mailslurp-provider';
import { MailGwProvider } from './mailgw-provider';
import { WebhookMailProvider } from './webhook-provider';

let cachedProvider: MailProvider | null = null;

export function getMailProvider(platform?: App.Platform): MailProvider {
	if (!cachedProvider) {
		const providerType = (platform?.env?.MAIL_PROVIDER || 'mock').toLowerCase();
		const customDomains = (platform?.env?.CUSTOM_DOMAINS || 'yaoi.web.id')
			.split(',')
			.map((d) => d.trim())
			.filter(Boolean);

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

	// Per-call: bind platform so KV-backed providers can read bindings.
	// Providers that don't need platform simply ignore the call.
	const maybeBind = cachedProvider as unknown as { bind?: (p: App.Platform | undefined) => void };
	if (typeof maybeBind.bind === 'function') {
		maybeBind.bind(platform);
	}

	return cachedProvider;
}
