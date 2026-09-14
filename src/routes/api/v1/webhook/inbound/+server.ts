import { json, type RequestHandler } from '@sveltejs/kit';
import { receiveInboundWebhookEmail } from '$lib/server/mail/webhook-provider';
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
	if (expected && !authHeader.includes(expected)) {
		return err('UNAUTHORIZED', 'Unauthorized webhook request', 401);
	}

	try {
		const body = await request.json();
		const to = (body.to ?? body.recipient ?? (Array.isArray(body.to) ? body.to[0] : '') ?? '').toString().trim();
		const from = (body.from ?? body.sender ?? 'unknown@sender.com').toString();
		const fromName = body.from_name ?? body.fromName ?? from;
		const subject = body.subject ?? '(No Subject)';
		const text = body.text ?? body.body ?? '';
		const html = body.html ?? body.body_html ?? '';

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
