import { json, type RequestHandler } from '@sveltejs/kit';
import { receiveInboundWebhookEmail } from '$lib/server/mail/webhook-provider';
import { securityHeaders } from '$lib/server/security';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {

	const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-secret') || '';
	if (env.WEBHOOK_SECRET && !authHeader.includes(env.WEBHOOK_SECRET)) {
		return json({ success: false, error: 'Unauthorized webhook request' }, { status: 401 });
	}

	try {
		const body = await request.json();
		

		const to = body.to || body.recipient || (Array.isArray(body.to) ? body.to[0] : '') || '';
		const from = body.from || body.sender || 'unknown@sender.com';
		const fromName = body.from_name || body.fromName || from;
		const subject = body.subject || '(No Subject)';
		const text = body.text || body.body || '';
		const html = body.html || body.body_html || '';

		if (!to || !to.includes('@')) {
			return json({ success: false, error: 'Invalid or missing "to" email address' }, { status: 400 });
		}

		const msg = receiveInboundWebhookEmail({
			to,
			from,
			fromName,
			subject,
			text,
			html
		});

		return json(
			{
				success: true,
				data: {
					id: msg.id,
					to: msg.mailboxAddress,
					subject: msg.subject
				}
			},
			{ headers: securityHeaders }
		);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Error processing inbound email';
		return json({ success: false, error: message }, { status: 500, headers: securityHeaders });
	}
};
