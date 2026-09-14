import type { RequestHandler } from '@sveltejs/kit';
import { getDomains } from '$lib/server/mail';
import { getMailProvider } from '$lib/server/mail/provider';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * GET /api/v1/stats
 * Public read-only stats — useful for health dashboards and the docs page.
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	try {
		const domains = await getDomains(event.platform);
		const provider = getMailProvider(event.platform);
		const env = event.platform?.env;

		return ok({
			provider: { id: (env?.MAIL_PROVIDER ?? 'mock').toLowerCase(), name: provider.name },
			domains: { total: domains.length, online: domains.filter((d) => d.status === 'online').length },
			config: {
				maxRequestsPerMinute: Number(env?.MAX_REQUESTS_PER_MINUTE ?? 120),
				mailboxLifetimeMinutes: Number(env?.MAILBOX_LIFETIME_MINUTES ?? 60),
				customDomains: (env?.CUSTOM_DOMAINS ?? '').split(',').map((d) => d.trim()).filter(Boolean)
			},
			uptime: { timestamp: new Date().toISOString() }
		});
	} catch (e: unknown) {
		return err('STATS_FETCH_FAILED', e instanceof Error ? e.message : 'Failed to load stats', 500);
	}
};
