// src/lib/server/mail/extract.ts
// Pull actionable bits out of an email body: OTP codes and verification URLs.
// Server-side only — results are rendered as copy buttons in the UI.

export interface ExtractedItem {
	kind: 'otp' | 'url';
	value: string;
	/** A short human label for the button: "Code 123456" or the bare URL host. */
	label: string;
}

const OTP_RE = [
	// Explicit code labels: "your code is 123456", "OTP: 482913", "verification code 4412"
	/(?:verification\s+code|security\s+code|access\s+code|one[- ]?time\s+(?:password|code)|otp|pin|code)[^0-9A-Za-z]{0,12}([0-9]{4,8})\b/i,
	// Standalone 4–8 digit run surrounded by word boundaries (most common case)
	/\b([0-9]{4,8})\b/
];

const URL_RE = /\bhttps?:\/\/[^\s"'<>\])\\]+/gi;

/** Numeric-only codes that should be ignored (years, port numbers, etc.). */
function looksJunk(code: string): boolean {
	const n = parseInt(code, 10);
	// Years 2000–2099 and 19xx are almost never OTPs.
	if (/^(19|20)\d{2}$/.test(code)) return true;
	// Repeated or sequential digits ("0000", "1234") are usually placeholders.
	if (/^(\d)\1{3,}$/.test(code)) return true;
	if (/^(0123|1234|2345|3456|4567|5678|6789|9876)$/.test(code)) return true;
	// Very long numbers are transaction IDs, not human-typed codes.
	if (code.length > 8) return true;
	return false;
}

/**
 * Extract OTPs and URLs from a plain-text body. Order: labels first, then
 * any standalone digits, then URLs. Deduped, capped at 6 items.
 *
 * Runs over the concatenation of text + html-derived text, because OTP codes
 * and verification links frequently live only in the HTML part.
 */
export function extractActionables(text: string, html?: string): ExtractedItem[] {
	const source = (text || '') + '\n' + (html ? html.replace(/<[^>]*>/g, ' ') : '');
	if (!source.trim()) return [];
	const found: ExtractedItem[] = [];
	const seen = new Set<string>();

	const push = (item: ExtractedItem) => {
		const key = item.kind + ':' + item.value;
		if (seen.has(key)) return;
		seen.add(key);
		found.push(item);
	};

	for (const re of OTP_RE) {
		const matches = source.matchAll(new RegExp(re.source, 'gi'));
		for (const m of matches) {
			const code = m[1];
			if (!code || looksJunk(code)) continue;
			push({ kind: 'otp', value: code, label: `Code ${code}` });
			if (found.filter((f) => f.kind === 'otp').length >= 3) break;
		}
		if (found.filter((f) => f.kind === 'otp').length >= 3) break;
	}

	for (const m of source.matchAll(URL_RE)) {
		let url = m[0].replace(/[.,;:)]+$/, '');
		try {
			const host = new URL(url).host;
			push({ kind: 'url', value: url, label: host });
		} catch {
			push({ kind: 'url', value: url, label: url.replace(/^https?:\/\//, '').slice(0, 40) });
		}
	}

	return found.slice(0, 6);
}

/**
 * Render GitHub-flavoured-ish markdown to HTML. Deliberately small: headings,
 * bold/italic, inline code, links, lists, blockquotes, hr. Tables and nested
 * lists are intentionally out of scope — transactional email bodies rarely use
 * them, and the output is sanitized anyway before it reaches the DOM.
 */
export function markdownToHtml(md: string): string {
	if (!md) return '';

	const esc = (s: string) =>
		s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

	const lines = md.replace(/\r\n/g, '\n').split('\n');
	let html = '';
	let inList = false;
	let inQuote = false;
	let para: string[] = [];

	const flushPara = () => {
		if (!para.length) return;
		html += `<p>${inline(para.join(' '))}</p>\n`;
		para = [];
	};
	const closeBlocks = () => {
		if (inList) { html += '</ul>\n'; inList = false; }
		if (inQuote) { html += '</blockquote>\n'; inQuote = false; }
	};

	const inline = (s: string): string => {
		let out = esc(s);
		// inline code first so its contents aren't re-processed
		out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
		// links: [text](url)  and bare urls already handled by the extractor
		out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
		out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
		out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
		return out;
	};

	for (const raw of lines) {
		const line = raw.trimEnd();

		if (!line.trim()) {
			flushPara();
			closeBlocks();
			continue;
		}

		// headings
		const h = line.match(/^(#{1,6})\s+(.*)$/);
		if (h) {
			flushPara();
			closeBlocks();
			const lvl = h[1].length;
			html += `<h${lvl}>${inline(h[2])}</h${lvl}>\n`;
			continue;
		}
		// hr
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
			flushPara();
			closeBlocks();
			html += '<hr>\n';
			continue;
		}
		// blockquote
		const q = line.match(/^>\s?(.*)$/);
		if (q) {
			flushPara();
			if (inList) { html += '</ul>\n'; inList = false; }
			if (!inQuote) { html += '<blockquote>\n'; inQuote = true; }
			html += `<p>${inline(q[1])}</p>\n`;
			continue;
		}
		// unordered list
		const li = line.match(/^[-*+]\s+(.*)$/);
		if (li) {
			flushPara();
			if (inQuote) { html += '</blockquote>\n'; inQuote = false; }
			if (!inList) { html += '<ul>\n'; inList = true; }
			html += `<li>${inline(li[1])}</li>\n`;
			continue;
		}
		// ordered list
		const ol = line.match(/^\d+\.\s+(.*)$/);
		if (ol) {
			flushPara();
			if (inQuote) { html += '</blockquote>\n'; inQuote = false; }
			if (!inList) { html += '<ul>\n'; inList = true; }
			html += `<li>${inline(ol[1])}</li>\n`;
			continue;
		}

		closeBlocks();
		para.push(line.trim());
	}

	flushPara();
	closeBlocks();
	return html;
}
