import { json, type RequestHandler } from '@sveltejs/kit';
import { getDomains } from '$lib/server/mail';
import { checkRateLimit, securityHeaders } from '$lib/server/security';

export const GET: RequestHandler = async ({ getClientAddress }) => {
	const ip = getClientAddress();
	const rate = checkRateLimit(ip, 120);

	if (!rate.allowed) {
		return json(
			{
				success: false,
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: 'Too many requests. Please try again later.'
				}
			},
			{
				status: 429,
				headers: {
					...securityHeaders,
					'Retry-After': '60'
				}
			}
		);
	}

	try {
		const domains = await getDomains();
		return json(
			{
				success: true,
				data: {
					domains
				}
			},
			{
				headers: {
					...securityHeaders,
					'Cache-Control': 'public, max-age=60, s-maxage=300'
				}
			}
		);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to fetch domains';
		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message
				}
			},
			{
				status: 500,
				headers: securityHeaders
			}
		);
	}
};
