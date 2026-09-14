import type { RequestHandler } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/security';
import { getMailKV } from '$lib/server/db';
import type { EmailMessageDetail } from '$lib/server/mail/types';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * POST /api/v1/mailbox/[address]/mark-all-read
 *
 * Mark every unread message in the mailbox as read. Returns the number updated.
 */
export const POST: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 60);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) return err('INVALID_ADDRESS', 'Invalid email address', 400);

	try {
		const kv = getMailKV(event.platform);
		const key = `msgs:${address.toLowerCase()}`;
		const raw = await kv.get(key);
		if (!raw) return ok({ address, updated: 0 });

		const list: EmailMessageDetail[] = JSON.parse(raw);
		let updated = 0;
		for (const m of list) {
			if (!m.isRead) {
				m.isRead = true;
				updated++;
			}
		}
		if (updated > 0) {
			await kv.put(key, JSON.stringify(list), { expirationTtl: 86400 });
		}
		return ok({ address, updated });
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Failed to mark messages read', 500);
	}
};
