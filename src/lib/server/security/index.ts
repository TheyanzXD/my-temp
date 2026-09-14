import sanitizeHtml from 'sanitize-html';
import { rateLimitHit } from '../db';

export function sanitizeEmailHtml(html: string): string {
	if (!html) return '';

	return sanitizeHtml(html, {
		allowedTags: [
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
			'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
			'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span',
			'img', 'center', 'font', 'small', 'sub', 'sup'
		],
		allowedAttributes: {
			a: ['href', 'name', 'target', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height', 'style'],
			table: ['border', 'cellpadding', 'cellspacing', 'width', 'style', 'align'],
			tr: ['style', 'align'],
			td: ['style', 'align', 'colspan', 'rowspan', 'width'],
			th: ['style', 'align', 'colspan', 'rowspan', 'width'],
			div: ['style', 'align'],
			span: ['style'],
			p: ['style', 'align'],
			font: ['color', 'size', 'face']
		},
		selfClosing: ['img', 'br', 'hr'],
		allowedSchemes: ['http', 'https', 'mailto', 'data'],
		allowedSchemesByTag: {
			img: ['data', 'http', 'https']
		},
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', {
				target: '_blank',
				rel: 'noopener noreferrer nofollow'
			})
		},
		disallowedTagsMode: 'discard'
	});
}

/**
 * KV-backed sliding window rate limiter. Safe for Cloudflare Workers/Pages
 * (no in-memory state) and shared across all isolates globally.
 */
export async function checkRateLimit(
	platform: App.Platform | undefined,
	clientIp: string,
	maxRequests = 100,
	windowMs = 60 * 1000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
	const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
	return rateLimitHit(platform, clientIp, maxRequests, windowSec);
}

export const securityHeaders: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'X-XSS-Protection': '1; mode=block'
};
