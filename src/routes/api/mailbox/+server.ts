import { json, type RequestHandler } from '@sveltejs/kit';
import { createMailbox } from '$lib/server/mail';
import { checkRateLimit, securityHeaders } from '$lib/server/security';

export const POST: RequestHandler = async ({ request, getClientAddress, platform }) => {
	const ip = getClientAddress();
	const rate = await checkRateLimit(platform, ip, 30);

	if (!rate.allowed) {
		return json(
			{
				success: false,
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: 'Mailbox creation limit reached. Please wait a minute.'
				}
			},
			{
				status: 429,
				headers: securityHeaders
			}
		);
	}

	try {
		let username: string | undefined;
		let domain: string | undefined;

		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			try {
				const body = await request.json();
				if (body && typeof body === 'object') {
					if (typeof body.username === 'string') username = body.username.trim();
					if (typeof body.domain === 'string') domain = body.domain.trim();
				}
			} catch {
				// ignore
			}
		}

		if (username && !/^[a-zA-Z0-9._-]{2,30}$/.test(username)) {
			return json(
				{
					success: false,
					error: {
						code: 'INVALID_USERNAME',
						message: 'Username can only contain alphanumeric characters, dots, hyphens, and underscores (2-30 chars).'
					}
				},
				{ status: 400, headers: securityHeaders }
			);
		}

		const mailbox = await createMailbox(platform, username, domain);

		return json(
			{
				success: true,
				data: mailbox
			},
			{
				status: 201,
				headers: securityHeaders
			}
		);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to create mailbox';
		return json(
			{
				success: false,
				error: {
					code: 'CREATION_FAILED',
					message
				}
			},
			{ status: 500, headers: securityHeaders }
		);
	}
};
