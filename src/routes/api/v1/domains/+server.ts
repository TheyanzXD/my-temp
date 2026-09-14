import type { RequestHandler } from '@sveltejs/kit';
import { getDomains } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { ok, cacheHeaders, err, getIp } from '$lib/server/api/respond';

/**
 * GET /api/v1/domains
 * List advertised domains the API can create mailboxes on.
 *
 * Cache: 60s client, 5m edge.
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	try {
		const domains = await getDomains(event.platform);
		return ok({ domains, count: domains.length }, { headers: cacheHeaders.public60 });
	} catch (e: unknown) {
		return err('DOMAINS_FETCH_FAILED', e instanceof Error ? e.message : 'Failed to fetch domains', 500);
	}
};
