import sanitizeHtml from 'sanitize-html';

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


interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
	clientIp: string,
	maxRequests = 100,
	windowMs = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const entry = rateLimitMap.get(clientIp);


	if (rateLimitMap.size > 5000) {
		for (const [key, val] of rateLimitMap.entries()) {
			if (val.resetTime < now) {
				rateLimitMap.delete(key);
			}
		}
	}

	if (!entry || entry.resetTime < now) {
		const newEntry: RateLimitEntry = {
			count: 1,
			resetTime: now + windowMs
		};
		rateLimitMap.set(clientIp, newEntry);
		return {
			allowed: true,
			remaining: maxRequests - 1,
			resetTime: newEntry.resetTime
		};
	}

	entry.count += 1;
	const remaining = Math.max(0, maxRequests - entry.count);

	return {
		allowed: entry.count <= maxRequests,
		remaining,
		resetTime: entry.resetTime
	};
}


export const securityHeaders: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'X-XSS-Protection': '1; mode=block'
};
