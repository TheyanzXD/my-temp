import type { RequestHandler } from '@sveltejs/kit';
import { createMailbox } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { ok, err, getIp } from '$lib/server/api/respond';

/**
 * POST /api/v1/mailbox
 * Create a new disposable mailbox.
 *
 * Body (JSON, all fields optional):
 *   { "username": "alice", "domain": "yoai.my.id" }
 *
 * If `username` is omitted a random username is generated.
 * If `domain` is omitted the first available domain is used.
 */
export const POST: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 30); // tighter limit on creation
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Mailbox creation limit reached. Please wait a minute.', 429, undefined, { 'Retry-After': '60' });

	let username: string | undefined;
	let domain: string | undefined;
	let lifetimeMinutes: number | undefined;

	const contentType = event.request.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		try {
			const body = await event.request.json();
			if (body && typeof body === 'object') {
				if (typeof body.username === 'string') username = body.username.trim();
				if (typeof body.domain === 'string') domain = body.domain.trim();
				if (typeof body.lifetimeMinutes === 'number' && body.lifetimeMinutes > 0 && body.lifetimeMinutes <= 1440) {
					lifetimeMinutes = body.lifetimeMinutes;
				}
			}
		} catch {
			// tolerate empty body
		}
	}

	if (username && !/^[a-zA-Z0-9._-]{2,30}$/.test(username)) {
		return err(
			'INVALID_USERNAME',
			'Username can only contain alphanumeric characters, dots, hyphens, and underscores (2-30 chars).',
			400
		);
	}

	try {
		const mailbox = await createMailbox(event.platform, username, domain);
		// Honor lifetime override on top of provider's default if requested
		if (lifetimeMinutes !== undefined) {
			const expires = new Date(Date.now() + lifetimeMinutes * 60 * 1000).toISOString();
			mailbox.expiresAt = expires;
		}
		return ok(mailbox, { status: 201 });
	} catch (e: unknown) {
		return err('CREATION_FAILED', e instanceof Error ? e.message : 'Failed to create mailbox', 500);
	}
};
