import { json, type RequestHandler } from '@sveltejs/kit';
import { ok, securityHeaders } from '$lib/server/api/respond';

export const GET: RequestHandler = async ({ platform, request }) => {
	const cfVer = (request as Request & { cf?: { colo?: string } }).cf?.colo;
	return json(
		{
			ok: true,
			service: 'my-temp',
			version: '1.0.0',
			timestamp: new Date().toISOString(),
			colo: cfVer ?? 'unknown'
		},
		{ headers: securityHeaders }
	);
};
