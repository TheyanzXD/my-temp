import type { RequestHandler } from '@sveltejs/kit';
import { getMessages } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp, cacheHeaders } from '$lib/server/api/respond';

/**
 * GET /api/v1/mailbox/[address]/messages
 *   List all messages for a mailbox (newest first).
 *
 * Query params:
 *   ?unread=true    — only unread messages
 *   ?limit=N        — cap response to N messages (max 200)
 *   ?offset=N       — skip first N messages
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) return err('INVALID_ADDRESS', 'Invalid email address', 400);

	const url = event.url;
	const unreadOnly = url.searchParams.get('unread') === 'true';
	const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '200')));
	const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));

	try {
		let messages = await getMessages(event.platform, address);
		if (unreadOnly) messages = messages.filter((m) => !m.isRead);
		const total = messages.length;
		const page = messages.slice(offset, offset + limit);

		return ok(
			{
				address,
				total,
				count: page.length,
				offset,
				limit,
				hasMore: offset + page.length < total,
				messages: page
			},
			{ headers: cacheHeaders.noStore }
		);
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Error fetching messages', 500);
	}
};

/**
 * DELETE /api/v1/mailbox/[address]/messages
 *   Delete ALL messages in a mailbox (mailbox stays alive).
 */
export const DELETE: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 30);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) return err('INVALID_ADDRESS', 'Invalid email address', 400);

	try {
		const { deleteMailbox } = await import('$lib/server/mail');
		// Use the provider's delete-mailbox to clear messages, then re-create.
		// Simpler: directly overwrite messages list with empty via KV.
		const { getMailKV } = await import('$lib/server/db');
		const kv = getMailKV(event.platform);
		await kv.put(`msgs:${address.toLowerCase()}`, '[]', { expirationTtl: 86400 });
		return ok({ address, deleted: true, count: 0 });
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Failed to clear messages', 500);
	}
};
