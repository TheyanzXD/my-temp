import { json, type RequestHandler } from '@sveltejs/kit';
import { getMessage, deleteMessage } from '$lib/server/mail';
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
	const id = params.id;

	if (!address || !id) {
		return json(
			{
				success: false,
				error: { code: 'INVALID_REQUEST', message: 'Missing address or message ID' }
			},
			{ status: 400, headers: securityHeaders }
		);
	}

	try {
		const message = await getMessage(address, id);
		if (!message) {
			return json(
				{
					success: false,
					error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found' }
				},
				{ status: 404, headers: securityHeaders }
			);
		}

		return json(
			{
				success: true,
				data: message
			},
			{
				headers: {
					...securityHeaders,
					'Cache-Control': 'no-store, no-cache, must-revalidate'
				}
			}
		);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Error fetching message detail';
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message }
			},
			{ status: 500, headers: securityHeaders }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, getClientAddress }) => {
	const ip = getClientAddress();
	const rate = checkRateLimit(ip, 60);

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
	const id = params.id;

	if (!address || !id) {
		return json(
			{
				success: false,
				error: { code: 'INVALID_REQUEST', message: 'Missing address or message ID' }
			},
			{ status: 400, headers: securityHeaders }
		);
	}

	try {
		const deleted = await deleteMessage(address, id);
		return json(
			{
				success: true,
				data: { deleted, id }
			},
			{ headers: securityHeaders }
		);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Error deleting message';
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message }
			},
			{ status: 500, headers: securityHeaders }
		);
	}
};
