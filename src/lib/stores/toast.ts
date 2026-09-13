import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	title: string;
	description?: string;
	type?: 'info' | 'success' | 'warning' | 'error';
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	return {
		subscribe,
		add: (toast: Omit<Toast, 'id'>) => {
			const id = Math.random().toString(36).substring(2, 9);
			const newToast: Toast = { id, duration: 4000, type: 'info', ...toast };

			update((toasts) => [...toasts, newToast]);

			if (newToast.duration && newToast.duration > 0) {
				setTimeout(() => {
					update((toasts) => toasts.filter((t) => t.id !== id));
				}, newToast.duration);
			}

			return id;
		},
		success: (title: string, description?: string) => {
			return createToastStore().add({ title, description, type: 'success' });
		},
		error: (title: string, description?: string) => {
			return createToastStore().add({ title, description, type: 'error' });
		},
		remove: (id: string) => {
			update((toasts) => toasts.filter((t) => t.id !== id));
		},
		clear: () => {
			update(() => []);
		}
	};
}

export const toasts = createToastStore();
