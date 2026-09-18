import { writable } from 'svelte/store';
import type { Mailbox, EmailMessageSummary, EmailMessageDetail, DomainInfo } from '$lib/server/mail/types';
import { toasts } from '$lib/stores/toast';

interface MailState {
	mailbox: Mailbox | null;
	domains: DomainInfo[];
	messages: EmailMessageSummary[];
	selectedMessage: EmailMessageDetail | null;
	loading: boolean;
	messagesLoading: boolean;
	sseConnected: boolean;
	error: string | null;
}

function createMailboxStore() {
	const { subscribe, set, update } = writable<MailState>({
		mailbox: null,
		domains: [],
		messages: [],
		selectedMessage: null,
		loading: false,
		messagesLoading: false,
		sseConnected: false,
		error: null
	});

	let eventSource: EventSource | null = null;
	let currentAddress: string | null = null;
	let pollingTimer: ReturnType<typeof setInterval> | null = null;

	const handleIncomingMessages = (newMessages: EmailMessageSummary[]) => {
		update((s) => {
			const prevCount = s.messages.length;
			const newCount = newMessages.length;
			if (newCount > prevCount && prevCount > 0) {
				toasts.add({
					title: 'New email received!',
					description: newMessages[0]?.subject || 'Check your inbox',
					type: 'info'
				});

				if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
					new Notification('New TempMail Received', {
						body: newMessages[0]?.subject || 'New message in your temporary inbox',
						icon: '/favicon.svg'
					});
				}
			}
			return { ...s, messages: newMessages, messagesLoading: false };
		});
	};

	const disconnectSSE = () => {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		update((s) => ({ ...s, sseConnected: false }));
	};

	const stopPolling = () => {
		if (pollingTimer) {
			clearInterval(pollingTimer);
			pollingTimer = null;
		}
	};

	const startPolling = (address: string) => {
		stopPolling();
		if (typeof window === 'undefined' || !address) return;
		// Poll every 4s as fallback/supplement to SSE
		pollingTimer = setInterval(async () => {
			if (!currentAddress) return;
			try {
				const res = await fetch(`/api/v1/mailbox/${encodeURIComponent(currentAddress)}/messages`);
				const json = await res.json();
				if (json.success && Array.isArray(json.data?.messages)) {
					handleIncomingMessages(json.data.messages);
				}
			} catch {
				// ignore transient network glitch in background poll
			}
		}, 4000);
	};

	const connectSSE = (address: string) => {
		disconnectSSE();
		if (typeof window === 'undefined' || !address) return;

		startPolling(address);

		try {
			eventSource = new EventSource(`/api/v1/mailbox/${encodeURIComponent(address)}/events`);

			eventSource.onopen = () => {
				update((s) => ({ ...s, sseConnected: true }));
			};

			eventSource.addEventListener('messages', (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.messages && Array.isArray(data.messages)) {
						handleIncomingMessages(data.messages);
					}
				} catch {
					// noop
				}
			});

			eventSource.addEventListener('mailbox_status', (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.expired) {
						toasts.add({ title: 'Mailbox expired', description: 'Generating a fresh inbox for you.', type: 'warning' });
						mailboxStore.createMailbox();
					}
				} catch {
					// noop
				}
			});

			eventSource.onerror = () => {
				update((s) => ({ ...s, sseConnected: false }));
			};
		} catch {
			update((s) => ({ ...s, sseConnected: false }));
		}
	};

	const mailboxStore = {
		subscribe,

		init: async () => {
			if (typeof window === 'undefined') return;

			if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
				Notification.requestPermission();
			}

			// Add visibility change listener to refresh instantly when returning to tab
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && currentAddress) {
					mailboxStore.fetchMessages();
				}
			});

			await mailboxStore.fetchDomains();

			const saved = localStorage.getItem('tempmail_current_address');
			if (saved) {
				const restored = await mailboxStore.fetchMailbox(saved);
				if (!restored) {
					await mailboxStore.createMailbox();
				}
			} else {
				await mailboxStore.createMailbox();
			}
		},

		fetchDomains: async () => {
			try {
				const res = await fetch('/api/v1/domains/all');
				const json = await res.json();
				if (json.success && Array.isArray(json.data.domains)) {
					// /api/v1/domains/all returns rows enriched with `provider` + `providerLabel`.
					// The store's DomainInfo type doesn't have those, so we keep them as
					// unknown extra keys and widen on the UI side via `(d as any).providerLabel`.
					update((s) => ({ ...s, domains: json.data.domains }));
				}
			} catch (err) {
				// Fallback to the active-only endpoint if the union endpoint isn't built yet.
				try {
					const res = await fetch('/api/v1/domains');
					const json = await res.json();
					if (json.success && Array.isArray(json.data.domains)) {
						update((s) => ({ ...s, domains: json.data.domains }));
					}
				} catch {
					console.error('Failed to fetch domains', err);
				}
			}
		},

		createMailbox: async (username?: string, domain?: string) => {
			update((s) => ({ ...s, loading: true, error: null, selectedMessage: null }));
			try {
				const res = await fetch('/api/v1/mailbox', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username, domain })
				});

				const json = await res.json();
				if (!json.success) {
					throw new Error(json.error?.message || 'Failed to create mailbox');
				}

				const mb: Mailbox = json.data;
				currentAddress = mb.address;
				localStorage.setItem('tempmail_current_address', mb.address);

				update((s) => ({
					...s,
					mailbox: mb,
					messages: [],
					loading: false
				}));

				toasts.add({ title: 'Inbox ready', description: mb.address, type: 'success', duration: 3000 });
				connectSSE(mb.address);
				await mailboxStore.fetchMessages();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : 'Error creating mailbox';
				update((s) => ({ ...s, loading: false, error: msg }));
				toasts.add({ title: 'Creation failed', description: msg, type: 'error' });
			}
		},

		fetchMailbox: async (address: string): Promise<boolean> => {
			update((s) => ({ ...s, loading: true }));
			try {
				const res = await fetch(`/api/v1/mailbox/${encodeURIComponent(address)}`);
				const json = await res.json();
				if (!json.success || !json.data) {
					return false;
				}

				const mb: Mailbox = json.data;
				currentAddress = mb.address;
				update((s) => ({ ...s, mailbox: mb, loading: false }));
				connectSSE(mb.address);
				await mailboxStore.fetchMessages();
				return true;
			} catch {
				update((s) => ({ ...s, loading: false }));
				return false;
			}
		},

		fetchMessages: async () => {
			let address = '';
			update((s) => {
				address = s.mailbox?.address || '';
				return { ...s, messagesLoading: true };
			});

			if (!address) return;

			try {
				const res = await fetch(`/api/v1/mailbox/${encodeURIComponent(address)}/messages`);
				const json = await res.json();
				if (json.success && json.data.messages) {
					update((s) => ({
						...s,
						messages: json.data.messages,
						messagesLoading: false
					}));
				} else {
					update((s) => ({ ...s, messagesLoading: false }));
				}
			} catch {
				update((s) => ({ ...s, messagesLoading: false }));
			}
		},

		selectMessage: async (msgSummary: EmailMessageSummary) => {
			let address = '';
			update((s) => {
				address = s.mailbox?.address || '';
				return s;
			});

			if (!address) return;

			try {
				const res = await fetch(`/api/v1/mailbox/${encodeURIComponent(address)}/messages/${msgSummary.id}`);
				const json = await res.json();
				if (json.success && json.data) {
					update((s) => ({
						...s,
						selectedMessage: json.data,
						messages: s.messages.map((m) => (m.id === msgSummary.id ? { ...m, isRead: true } : m))
					}));
				}
			} catch {
				toasts.add({ title: 'Failed to load email detail', type: 'error' });
			}
		},

		clearSelectedMessage: () => {
			update((s) => ({ ...s, selectedMessage: null }));
		},

		deleteMessage: async (messageId: string) => {
			let address = '';
			update((s) => {
				address = s.mailbox?.address || '';
				return s;
			});

			if (!address) return;

			try {
				const res = await fetch(`/api/v1/mailbox/${encodeURIComponent(address)}/messages/${messageId}`, {
					method: 'DELETE'
				});
				const json = await res.json();
				if (json.success) {
					update((s) => ({
						...s,
						selectedMessage: s.selectedMessage?.id === messageId ? null : s.selectedMessage,
						messages: s.messages.filter((m) => m.id !== messageId)
					}));
					toasts.add({ title: 'Email deleted', type: 'info', duration: 2000 });
				}
			} catch {
				toasts.add({ title: 'Failed to delete email', type: 'error' });
			}
		},

		deleteMailbox: async () => {
			let address = '';
			update((s) => {
				address = s.mailbox?.address || '';
				return s;
			});

			if (!address) return;

			disconnectSSE();
			stopPolling();
			try {
				await fetch(`/api/v1/mailbox/${encodeURIComponent(address)}`, { method: 'DELETE' });
				localStorage.removeItem('tempmail_current_address');
				toasts.add({ title: 'Mailbox deleted', type: 'info' });
				await mailboxStore.createMailbox();
			} catch {
				await mailboxStore.createMailbox();
			}
		},

		destroy: () => {
			disconnectSSE();
			stopPolling();
		}
	};

	return mailboxStore;
}

export const mailStore = createMailboxStore();
