<script lang="ts">
	import type { DomainInfo } from '$lib/server/mail/types';
	import { Copy, Trash2, Plus, Wifi, WifiOff, Clock, Sparkles } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let {
		address,
		countdownText,
		sseConnected,
		onGenerateNew,
		onDelete
	}: {
		address: string;
		countdownText: string;
		sseConnected: boolean;
		onGenerateNew: () => void;
		onDelete: () => void;
	} = $props();

	let copied = $state(false);

	async function copyAddress() {
		if (!address) return;
		try {
			await navigator.clipboard.writeText(address);
			copied = true;
			toasts.add({ title: 'Address copied', type: 'success', duration: 1800 });
			setTimeout(() => (copied = false), 1800);
		} catch {
			toasts.add({ title: 'Failed to copy', type: 'error' });
		}
	}
</script>

<div class="flex flex-col gap-4 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
	<!-- Active Mailbox Info -->
	<div class="space-y-1.5">
		<div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
			<span class="font-medium">Active Mailbox</span>
			<div class="flex items-center gap-1.5 text-[11px]">
				{#if sseConnected}
					<span class="relative flex h-2 w-2">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
					</span>
					<span class="text-emerald-600 dark:text-emerald-400">Live</span>
				{:else}
					<span class="h-2 w-2 rounded-full bg-amber-500"></span>
					<span class="text-amber-600 dark:text-amber-400">Polling</span>
				{/if}
			</div>
		</div>

		<div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 break-all select-all">
			{address || '...'}
		</div>
	</div>

	<!-- Expiration Progress -->
	<div class="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400">
		<div class="flex items-center gap-1.5">
			<Clock class="h-3.5 w-3.5 text-zinc-400" />
			<span>Lifetime</span>
		</div>
		<span class="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{countdownText}</span>
	</div>

	<!-- Quick Actions -->
	<div class="flex flex-col gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/40">
		<button
			onclick={copyAddress}
			class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
		>
			<Copy class="h-3.5 w-3.5 text-zinc-400" />
			<span>{copied ? 'Copied!' : 'Copy Address'}</span>
		</button>

		<button
			onclick={onGenerateNew}
			class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
		>
			<Plus class="h-3.5 w-3.5" />
			<span>Generate New</span>
		</button>

		<button
			onclick={onDelete}
			class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
		>
			<Trash2 class="h-3.5 w-3.5" />
			<span>Delete Mailbox</span>
		</button>
	</div>
</div>
