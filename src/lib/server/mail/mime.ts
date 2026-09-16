// src/lib/server/mail/mime.ts
// Minimal MIME/RFC822 parser — extracts a clean text body from raw mail.
// Zero deps. Handles: multipart boundaries, quoted-printable, base64,
// Content-Transfer-Encoding, and soft line wrapping. Headers are left to the
// caller (the webhook already extracts to/from/subject from CF Email Routing).

interface MimePart {
	headers: Map<string, string>;
	body: string;
}

const CRLF = /\r?\n/;

/** Decode a raw RFC822 message into clean plain-text body. */
export function parseMailText(raw: string): string {
	if (!raw) return '';
	const parts = splitMime(raw);

	// Prefer text/plain part; fall back to any text; last resort: first part.
	const chosen =
		parts.find((p) => p.headers.get('content-type')?.startsWith('text/plain')) ??
		parts.find((p) => p.headers.get('content-type')?.startsWith('text/')) ??
		parts[0];
	if (!chosen) return '';

	let body = chosen.body;
	const cte = (chosen.headers.get('content-transfer-encoding') || '').toLowerCase().trim();

	if (cte === 'quoted-printable') body = decodeQuotedPrintable(body);
	else if (cte === 'base64') body = decodeBase64(body);

	// Undo soft line wraps, collapse runs of blank lines, trim trailing space.
	return body
		.replace(/=\r?\n/g, '')
		.replace(/[ 	]+\r?\n/g, '\n')
		.replace(/\r?\n{3,}/g, '\n\n')
		.trim();
}

/** Extract an RFC822 header value as a plain string (strips folding + comments). */
export function cleanHeaderValue(raw: string | null | undefined): string {
	if (!raw) return '';
	return raw
		.replace(/\r?\n[ \t]+/g, ' ') // unfold continuation lines
		.replace(/\(.*?\)/g, '') // drop comments
		.trim();
}

// ---------- internals ----------

function splitMime(raw: string): MimePart[] {
	// Split head from body at the first blank line.
	const blank = raw.search(/\r?\n\r?\n/);
	const head = blank === -1 ? raw : raw.slice(0, blank);
	const body = blank === -1 ? '' : raw.slice(blank).replace(/^\r?\n\r?\n/, '');

	const headers = parseHeaders(head);
	const ctype = headers.get('content-type') || '';
	const boundaryMatch = ctype.match(/boundary\s*=\s*"?([^";\s]+)"?/i);
	const self: MimePart = { headers, body };

	if (!boundaryMatch) return [self];

	const b = boundaryMatch[1];
	// Escaped regex source; boundary chars are restricted so this is safe.
	const re = new RegExp('--' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const parts: MimePart[] = [];
	for (const chunk of body.split(re)) {
		const c = chunk.trim();
		if (!c || c.startsWith('--')) continue; // closing boundary or junk
		parts.push(...splitMime(c));
	}
	// If multipart yielded nothing usable, keep the whole body as one part.
	return parts.length ? parts : [self];
}

function parseHeaders(head: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const line of head.split(CRLF)) {
		if (!line) continue;
		const idx = line.indexOf(':');
		if (idx === -1) continue;
		const name = line.slice(0, idx).trim().toLowerCase();
		// Unfold: RFC5322 continuation lines start with space/tab.
		let value = line.slice(idx + 1).replace(/\r?\n[ \t]+/g, ' ');
		value = value.replace(/\(.*?\)/g, '').trim();
		if (!map.has(name)) map.set(name, value);
	}
	return map;
}

function decodeQuotedPrintable(input: string): string {
	let out = '';
	let i = 0;
	while (i < input.length) {
		const ch = input[i];
		if (ch === '=') {
			const next = input[i + 1];
			// Soft line break: "=" at end of line — drop.
			if (next === '\r' || next === '\n') {
				i += next === '\r' && input[i + 2] === '\n' ? 3 : 2;
				continue;
			}
			const hex = input.slice(i + 1, i + 3);
			if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
				out += String.fromCharCode(parseInt(hex, 16));
				i += 3;
				continue;
			}
		}
		out += ch;
		i += 1;
	}
	// QP-encoded words in headers are UTF-8; bodies may be latin1-ish. This is
	// a best-effort decode for display, not a byte-exact round trip.
	return out;
}

function decodeBase64(input: string): string {
	try {
		const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
		const bin = atob(clean);
		// Convert binary string to UTF-8 text.
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
	} catch {
		return input;
	}
}
