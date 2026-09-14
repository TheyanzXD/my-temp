import type { RequestHandler } from '@sveltejs/kit';
import { getMessages, getMailbox } from '$lib/server/mail';
import { checkRateLimit } from '$lib/server/security';

export const GET: RequestHandler = async ({ params, getClientAddress, request, platform }) => {
	const ip = getClientAddress();
	const rate = await checkRateLimit(platform, ip, 120);

	if (!rate.allowed) {
		return new Response('Rate limit exceeded', { status: 429 });
	}

	const address = params.address;
	if (!address || !address.includes('@')) {
		return new Response('Invalid address', { status: 400 });
	}

	let isAborted = false;
	let timer: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (event: string, data: unknown) => {
				if (isAborted) return;
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					cleanup();
				}
			};

			const cleanup = () => {
				isAborted = true;
				if (timer) {
					clearInterval(timer);
					timer = null;
				}
			};

			request.signal.addEventListener('abort', cleanup);

			try {
				const mailbox = await getMailbox(platform, address);
				if (!mailbox) {
					sendEvent('mailbox_status', { error: 'Mailbox not found or expired', expired: true });
					controller.close();
					return;
				}

				sendEvent('mailbox_status', { mailbox });
				const initialMessages = await getMessages(platform, address);
				sendEvent('messages', { messages: initialMessages });

				let lastCount = initialMessages.length;
				let lastIds = initialMessages.map((m) => m.id).join(',');

				timer = setInterval(async () => {
					if (isAborted) {
						cleanup();
						return;
					}

					try {
						const mb = await getMailbox(platform, address);
						if (!mb) {
							sendEvent('mailbox_status', { error: 'Mailbox expired', expired: true });
							cleanup();
							try {
								controller.close();
							} catch {
								/* noop */
							}
							return;
						}

						const msgs = await getMessages(platform, address);
						const currentIds = msgs.map((m) => m.id).join(',');

						if (msgs.length !== lastCount || currentIds !== lastIds) {
							lastCount = msgs.length;
							lastIds = currentIds;
							sendEvent('messages', { messages: msgs, newEmail: true });
						} else {
							sendEvent('ping', { time: Date.now() });
						}
					} catch {
						/* keep stream alive on transient errors */
					}
				}, 3000);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : 'SSE error';
				sendEvent('error', { message });
				cleanup();
			}
		},
		cancel() {
			isAborted = true;
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
