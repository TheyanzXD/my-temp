import type { RequestHandler } from '@sveltejs/kit';
import { getMailProvider } from '$lib/server/mail/provider';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * GET /api/v1/providers
 * Returns the active provider and the list of providers the build supports.
 */
const KNOWN_PROVIDERS = [
	{ id: 'webhook', name: 'Cloudflare Email Routing / Webhook', needs: 'Cloudflare Email Routing or ImprovMX/ForwardEmail' },
	{ id: 'mock', name: 'KV-backed Demo', needs: 'none' },
	{ id: 'mailgw', name: 'mail.tm / mail.gw Public API', needs: 'none' },
	{ id: 'mailslurp', name: 'MailSlurp Enterprise', needs: 'MAIL_API_KEY' },
	{ id: 'improvmx', name: 'ImprovMX Webhook', needs: 'ImprovMX account' },
	{ id: 'forwardemail', name: 'ForwardEmail Webhook', needs: 'ForwardEmail account' }
];

export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const active = getMailProvider(event.platform);
	const activeId = (event.platform?.env?.MAIL_PROVIDER ?? 'mock').toLowerCase();

	return ok({
		active: { id: activeId, name: active.name },
		available: KNOWN_PROVIDERS,
		customDomains: (event.platform?.env?.CUSTOM_DOMAINS ?? '').split(',').map((d) => d.trim()).filter(Boolean)
	});
};
