import { json, type RequestHandler } from '@sveltejs/kit';
import { getMessages } from '$lib/server/mail';
import { checkRateLimit, securityHeaders } from '$lib/server/security';

export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const ip = getClientAddress();
	const rate = checkRateLimit(ip, 120);

	if (!rate.allowed) {
		return json(
			{
				success: false,
				error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' }
			},
			{ status: 429, headers: securityHeaders }
		);
	}

	const address = params.address;
	if (!address || !address.includes('@')) {
		return json(
			{
				success: false,
				error: { code: 'INVALID_ADDRESS', message: 'Invalid email address' }
			},
			{ status: 400, headers: securityHeaders }
		);
	}

	try {
		const messages = await getMessages(address);
		return json(
			{
				success: true,
				data: {
					address,
					count: messages.length,
					messages
				}
			},
			{
				headers: {
					...securityHeaders,
					'Cache-Control': 'no-store, no-cache, must-revalidate'
				}
			}
		);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Error fetching messages';
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message }
			},
			{ status: 500, headers: securityHeaders }
		);
	}
};
