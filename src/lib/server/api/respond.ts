// Shared API response helpers — keep response shape consistent across all
// endpoints so clients can rely on `{ success, data }` / `{ success, error }`.

import { json } from '@sveltejs/kit';
import type { ApiResponse } from '$lib/server/mail/types';

export const securityHeaders: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'X-XSS-Protection': '1; mode=block'
};

export const cacheHeaders = {
	noStore: { ...securityHeaders, 'Cache-Control': 'no-store, no-cache, must-revalidate' },
	public60: { ...securityHeaders, 'Cache-Control': 'public, max-age=60, s-maxage=300' }
};

/** Build a success JSON response. */
export function ok<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}) {
	const body: ApiResponse<T> = { success: true, data };
	return json(body, { status: init.status ?? 200, headers: { ...securityHeaders, ...(init.headers ?? {}) } });
}

/** Build an error JSON response with a stable error code. */
export function err(
	code: string,
	message: string,
	status: number,
	details?: unknown,
	headers?: Record<string, string>
) {
	const body: ApiResponse<never> = { success: false, error: { code, message, details } };
	return json(body, { status, headers: { ...securityHeaders, ...(headers ?? {}) } });
}

/** Common rate-limited error shape with Retry-After hint. */
export function rateLimited(retryAfterSec = 60) {
	return err('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.', 429, undefined, {
		'Retry-After': String(retryAfterSec)
	});
}

/** Helper: read client IP from SvelteKit request event (handles Cloudflare cf). */
export function getIp(event: { getClientAddress: () => string; request: Request }): string {
	const cfIp = event.request.headers.get('cf-connecting-ip');
	if (cfIp) return cfIp;
	const xff = event.request.headers.get('x-forwarded-for');
	if (xff) return xff.split(',')[0].trim();
	try {
		return event.getClientAddress();
	} catch {
		return '0.0.0.0';
	}
}
