import type { RequestHandler } from '@sveltejs/kit';
import { getMessage, deleteMessage } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp, cacheHeaders } from '$lib/server/api/respond';

/**
 * GET    /api/v1/mailbox/[address]/messages/[id]
 *   Fetch a single message (full HTML body, sanitized, attachments list).
 *
 * DELETE /api/v1/mailbox/[address]/messages/[id]
 *   Delete one message.
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	const id = event.params.id;
	if (!address || !id) return err('INVALID_REQUEST', 'Missing address or message ID', 400);

	try {
		const message = await getMessage(event.platform, address, id);
		if (!message) return err('MESSAGE_NOT_FOUND', 'Message not found', 404);
		return ok(message, { headers: cacheHeaders.noStore });
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Error fetching message detail', 500);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 60);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	const id = event.params.id;
	if (!address || !id) return err('INVALID_REQUEST', 'Missing address or message ID', 400);

	try {
		const deleted = await deleteMessage(event.platform, address, id);
		if (!deleted) return err('MESSAGE_NOT_FOUND', 'Message not found', 404);
		return ok({ deleted, id });
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Error deleting message', 500);
	}
};
