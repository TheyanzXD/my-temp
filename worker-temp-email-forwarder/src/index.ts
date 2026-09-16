// temp-email-forwarder — Cloudflare Email Worker
// Forwards inbound mail to the temp-mail webhook endpoint.
// Updated 2026-09-16: send WEBHOOK_SECRET + fall back to temp.yaoi.web.id
// (yaoi.web.id is not yet attached to the Pages project → 403).

export interface Env {
	WEBHOOK_URL?: string;
	WEBHOOK_SECRET?: string;
}

const DEFAULT_ENDPOINTS = [
	'https://temp.yaoi.web.id/api/v1/webhook/inbound',
	'https://yaoi.web.id/api/v1/webhook/inbound'
];

export default {
	async email(message: ForwardedEmail, env: Env, ctx: ExecutionContext) {
		try {
			const raw = await new Response(message.raw).text();
			const headers = message.headers;
			const subject = headers.get('subject') || '(No Subject)';
			const messageId = headers.get('message-id') || '';
			const receivedAt = new Date().toISOString();

			const payload = {
				to: message.to,
				from: message.from,
				subject,
				text: raw,
				html: '',
				messageId,
				receivedAt
			};

			const secret = env.WEBHOOK_SECRET;
			const endpoints = env.WEBHOOK_URL ? env.WEBHOOK_URL.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ENDPOINTS;

			ctx.waitUntil(
				(async () => {
					for (const ep of endpoints) {
						try {
							const res = await fetch(ep, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									...(secret ? { 'x-webhook-secret': secret } : {})
								},
								body: JSON.stringify(payload)
							});
							// Success: no need to try the fallback.
							if (res.ok) return;
						} catch {
							// try next endpoint
						}
					}
				})()
			);
		} catch (e) {
			console.error('Email forward error:', e);
		}
	}
};
