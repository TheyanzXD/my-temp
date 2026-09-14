import { json, type RequestHandler } from '@sveltejs/kit';
import { getMailbox, deleteMailbox } from '$lib/server/mail';
import { checkRateLimit, securityHeaders } from '$lib/server/security';

export const GET: RequestHandler = async ({ params, getClientAddress, platform }) => {
	const ip = getClientAddress();
	const rate = await checkRateLimit(platform, ip, 120);

	if (!rate.allowed) {
		return json(
			{ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' } },
			{ status: 429, headers: securityHeaders }
		);
	}

	const address = params.address;
	if (!address || !address.includes('@')) {
		return json(
			{ success: false, error: { code: 'INVALID_ADDRESS', message: 'Invalid email address' } },
			{ status: 400, headers: securityHeaders }
		);
	}

	try {
		const mailbox = await getMailbox(platform, address);
		if (!mailbox) {
			return json(
				{ success: false, error: { code: 'MAILBOX_NOT_FOUND', message: 'Mailbox not found or expired' } },
				{ status: 404, headers: securityHeaders }
			);
		}

		return json({ success: true, data: mailbox }, { headers: securityHeaders });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Error retrieving mailbox';
		return json(
			{ success: false, error: { code: 'INTERNAL_ERROR', message } },
			{ status: 500, headers: securityHeaders }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, getClientAddress, platform }) => {
	const ip = getClientAddress();
	const rate = await checkRateLimit(platform, ip, 60);

	if (!rate.allowed) {
		return json(
			{ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' } },
			{ status: 429, headers: securityHeaders }
		);
	}

	const address = params.address;
	if (!address) {
		return json({ success: false, error: { code: 'INVALID_ADDRESS', message: 'Invalid email address' } }, { status: 400, headers: securityHeaders });
	}

	try {
		const deleted = await deleteMailbox(platform, address);
		return json({ success: true, data: { deleted, address } }, { headers: securityHeaders });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to delete mailbox';
		return json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500, headers: securityHeaders });
	}
};
