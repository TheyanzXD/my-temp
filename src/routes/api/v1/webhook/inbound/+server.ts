import { json, type RequestHandler } from '@sveltejs/kit';
import { receiveInboundWebhookEmail } from '$lib/server/mail/webhook-provider';
import { parseMailText } from '$lib/server/mail/mime';
import { ok, err } from '$lib/server/api/respond';

/**
 * POST /api/v1/webhook/inbound
 *
 * Inbound email webhook receiver. Authenticates via `WEBHOOK_SECRET` env
 * (sent as `Authorization: Bearer <secret>` or `x-webhook-secret: <secret>`).
 *
 * Expected JSON body:
 *   { "to": "...", "from": "...", "fromName": "...", "subject": "...",
 *     "text": "...", "html": "..." }
 *
 * The receiver auto-creates the mailbox record if it doesn't exist yet,
 * so messages are stored even before the user opens the UI.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const authHeader = request.headers.get('authorization') ?? request.headers.get('x-webhook-secret') ?? '';
	const expected = platform?.env?.WEBHOOK_SECRET;
	if (expected && expected.trim() !== '' && !authHeader.includes(expected)) {
		return err('UNAUTHORIZED', 'Unauthorized webhook request', 401);
	}

	try {
		const body = await request.json();
		if (!body || typeof body !== 'object') {
			return err('INVALID_BODY', 'Expected JSON payload', 400);
		}

		// Helper to extract a single clean string from diverse payload shapes
		const extractTo = (raw: unknown): string => {
			if (!raw) return '';
			if (typeof raw === 'string') return raw;
			if (Array.isArray(raw)) {
				const first = raw[0];
				return typeof first === 'string' ? first : (first?.address || first?.email || first?.value || '');
			}
			if (typeof raw === 'object' && raw !== null) {
				const obj = raw as Record<string, unknown>;
				return (obj.address || obj.email || obj.value || obj.recipient || '') as string;
			}
			return String(raw);
		};

		const rawTo = extractTo(
			body.to ?? body.recipient ?? body.recipients ?? body.envelope_to ?? body.to_email ?? body.delivered_to
		).trim();

		// Extract recipient email via regex or brackets
		const emailMatch = rawTo.match(/<([^>]+)>/) || rawTo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
		const to = (emailMatch ? emailMatch[1] : rawTo).toLowerCase().trim();

		let rawFrom = extractTo(body.from ?? body.sender ?? body.from_email ?? body.envelope_from ?? 'unknown@sender.com');
		const fromMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
		const from = (fromMatch ? fromMatch[1] : rawFrom).trim();
		const fromName = (body.from_name ?? body.fromName ?? rawFrom.replace(/<[^>]+>/, '').trim() ?? from).toString();

		const subject = (body.subject ?? body.title ?? '(No Subject)').toString();
		let text = (body.text ?? body.body ?? body.text_body ?? body.plain ?? '').toString();
		const html = (body.html ?? body.body_html ?? body.html_body ?? body.raw_html ?? '').toString();

		// The email worker forwards raw RFC822 (headers + MIME structure) as
		// `text` when the provider doesn't expose pre-parsed bodies. Detect that
		// and reduce it to clean readable text.
		if (text && /^(Received|From|To|Subject|MIME-Version|Content-Type):/im.test(text)) {
			text = parseMailText(text);
		}

		if (!to || !to.includes('@')) {
			return err('INVALID_RECIPIENT', 'Invalid or missing "to" email address', 400);
		}

		const msg = await receiveInboundWebhookEmail(platform, { to, from, fromName, subject, text, html });
		return ok({
			id: msg.id,
			to: msg.mailboxAddress,
			subject: msg.subject,
			receivedAt: msg.receivedAt
		}, { status: 201 });
	} catch (e: unknown) {
		return err('WEBHOOK_FAILED', e instanceof Error ? e.message : 'Error processing inbound email', 500);
	}
};
