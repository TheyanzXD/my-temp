import type { RequestHandler } from '@sveltejs/kit';
import { getMessages } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * GET /api/v1/mailbox/[address]/search?q=keyword
 *
 * Substring search across subject, from-address, from-name, and preview text.
 * Case-insensitive. Returns summaries only (no HTML body) for speed.
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) return err('INVALID_ADDRESS', 'Invalid email address', 400);

	const q = (event.url.searchParams.get('q') ?? '').trim().toLowerCase();
	if (!q) return err('MISSING_QUERY', 'Query parameter ?q= is required', 400);

	try {
		const messages = await getMessages(event.platform, address);
		const matches = messages.filter((m) => {
			const hay = [
				m.subject,
				m.from.address,
				m.from.name ?? '',
				m.preview,
				m.mailboxAddress
			]
				.join(' ')
				.toLowerCase();
			return hay.includes(q);
		});
		return ok({ address, query: q, count: matches.length, messages: matches });
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Search failed', 500);
	}
};
