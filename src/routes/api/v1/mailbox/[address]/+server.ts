import type { RequestHandler } from '@sveltejs/kit';
import { getMailbox, deleteMailbox } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * GET    /api/v1/mailbox/[address]
 *   Fetch mailbox info (id, expiry, messageCount).
 *
 * DELETE /api/v1/mailbox/[address]
 *   Permanently delete a mailbox and all its messages.
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) {
		return err('INVALID_ADDRESS', 'Invalid email address', 400);
	}

	try {
		const mailbox = await getMailbox(event.platform, address);
		if (!mailbox) return err('MAILBOX_NOT_FOUND', 'Mailbox not found or expired', 404);
		return ok(mailbox);
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Error retrieving mailbox', 500);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 60);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) {
		return err('INVALID_ADDRESS', 'Invalid email address', 400);
	}

	try {
		const deleted = await deleteMailbox(event.platform, address);
		return ok({ deleted, address });
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Failed to delete mailbox', 500);
	}
};
