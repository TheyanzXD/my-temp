import { env } from '$env/dynamic/private';
import type { MailProvider } from './types';
import { MockMailProvider } from './mock-provider';
import { MailSlurpProvider } from './mailslurp-provider';
import { MailGwProvider } from './mailgw-provider';
import { WebhookMailProvider } from './webhook-provider';

let cachedProvider: MailProvider | null = null;

export function getMailProvider(): MailProvider {
	if (cachedProvider) {
		return cachedProvider;
	}

	const providerType = (env.MAIL_PROVIDER || 'mock').toLowerCase();
	const customDomains = (env.CUSTOM_DOMAINS || 'mycustomdomain.com')
		.split(',')
		.map((d) => d.trim())
		.filter(Boolean);

	switch (providerType) {
		case 'mailgw':
		case 'mailtm':
			cachedProvider = new MailGwProvider();
			break;

		case 'mailslurp':
			if (!env.MAIL_API_KEY) {
				console.warn('⚠️ MAIL_API_KEY is not set for mailslurp provider. Falling back to MockMailProvider.');
				cachedProvider = new MockMailProvider();
			} else {
				cachedProvider = new MailSlurpProvider(env.MAIL_API_KEY, env.MAIL_API_URL);
			}
			break;

		case 'cloudflare':
		case 'cloudflare_workers':
			cachedProvider = new WebhookMailProvider('Cloudflare Email Routing', customDomains);
			break;

		case 'forwardemail':
			cachedProvider = new WebhookMailProvider('Forward Email Webhook', customDomains);
			break;

		case 'improvmx':
			cachedProvider = new WebhookMailProvider('ImprovMX Webhook', customDomains);
			break;

		case 'mock':
		default:
			cachedProvider = new MockMailProvider();
			break;
	}

	return cachedProvider;
}
