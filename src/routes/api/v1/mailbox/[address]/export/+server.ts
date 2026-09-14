import type { RequestHandler } from '@sveltejs/kit';
import { getMessages } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';
import { err, getIp, cacheHeaders } from '$lib/server/api/respond';

/**
 * GET /api/v1/mailbox/[address]/export?format=jsonl|json
 *
 * Download all messages as a file. Defaults to `jsonl` (one JSON object per line).
 * Useful for archiving or feeding into another tool.
 */
export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 30);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	const address = event.params.address;
	if (!address || !address.includes('@')) return err('INVALID_ADDRESS', 'Invalid email address', 400);

	const format = (event.url.searchParams.get('format') ?? 'jsonl').toLowerCase();
	if (format !== 'jsonl' && format !== 'json') {
		return err('INVALID_FORMAT', 'Only ?format=jsonl or ?format=json is supported', 400);
	}

	try {
		const messages = await getMessages(event.platform, address);
		const filename = `${address.replace('@', '_at_')}-${new Date().toISOString().slice(0, 10)}.${format}`;

		if (format === 'json') {
			return new Response(JSON.stringify({ address, exportedAt: new Date().toISOString(), count: messages.length, messages }, null, 2), {
				headers: {
					...cacheHeaders.noStore,
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${filename}"`
				}
			});
		}

		const body = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
		return new Response(body, {
			headers: {
				...cacheHeaders.noStore,
				'Content-Type': 'application/x-ndjson',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (e: unknown) {
		return err('INTERNAL_ERROR', e instanceof Error ? e.message : 'Export failed', 500);
	}
};
