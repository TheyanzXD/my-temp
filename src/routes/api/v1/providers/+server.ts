import type { RequestHandler } from '@sveltejs/kit';
import { getMailProvider } from '$lib/server/mail/provider';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * GET /api/v1/providers
 * Returns the active provider and the list of providers the build supports.
 */
// All known providers, ordered by ease-of-use / reliability for end users.
// `id` is what API consumers send as `MAIL_PROVIDER`, or what appears in `customDomains` / UI.
const KNOWN_PROVIDERS = [
	{
		id: 'webhook',
		name: 'Cloudflare Email Routing / Webhook (yaoi.web.id)',
		needs: 'Cloudflare Email Routing',
		docs: 'https://developers.cloudflare.com/email-routing/'
	},
	{
		id: 'mailtm',
		name: 'Mail.tm / Mail.gw (public REST + JWT)',
		needs: 'none',
		docs: 'https://docs.mail.tm'
	},
	{
		id: 'tempmailio',
		name: 'Temp-Mail.io internal API v3',
		needs: 'none',
		docs: 'https://temp-mail.io/en/api'
	},
	{
		id: 'guerrilla',
		name: 'GuerrillaMail public AJAX',
		needs: 'none',
		docs: 'https://www.guerrillamail.com/developer'
	},
	{
		id: 'composite',
		name: 'Composite (mail.tm → temp-mail.io → guerrilla fallback chain)',
		needs: 'none',
		docs: ''
	},
	{
		id: 'five',
		name: 'Five-Provider Auto-Rotator (rotates per minute across 5)',
		needs: 'none',
		docs: ''
	},
	{
		id: 'mock',
		name: 'KV-backed Demo (instant seed, no real mail)',
		needs: 'none',
		docs: ''
	},
	{
		id: 'mailslurp',
		name: 'MailSlurp Enterprise',
		needs: 'MAIL_API_KEY',
		docs: 'https://docs.mailslurp.com'
	},
	{
		id: 'improvmx',
		name: 'ImprovMX Webhook (alias of webhook provider)',
		needs: 'ImprovMX account',
		docs: 'https://improvmx.com/api'
	},
	{
		id: 'forwardemail',
		name: 'ForwardEmail Webhook (alias of webhook provider)',
		needs: 'ForwardEmail account',
		docs: 'https://forwardemail.net/guides'
	}
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
