import type { Handle } from '@sveltejs/kit';
import { securityHeaders } from '$lib/server/security';

export const handle: Handle = async ({ event, resolve }) => {

	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	const response = await resolve(event);


	for (const [key, value] of Object.entries(securityHeaders)) {
		response.headers.set(key, value);
	}


	response.headers.set('Access-Control-Allow-Origin', '*');

	return response;
};
