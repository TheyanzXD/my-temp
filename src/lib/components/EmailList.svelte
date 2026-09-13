<script lang="ts">
	import type { EmailMessageSummary } from '$lib/server/mail/types';
	import { formatTimeAgo } from '$lib/utils';
	import { Mail, Paperclip, ChevronRight, Inbox } from 'lucide-svelte';

	let {
		messages,
		selectedId,
		onSelect,
		loading = false
	}: {
		messages: EmailMessageSummary[];
		selectedId: string | null;
		onSelect: (msg: EmailMessageSummary) => void;
		loading?: boolean;
	} = $props();
</script>

<div class="flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
	{#if loading && messages.length === 0}
		<!-- Loading Skeleton -->
		<div class="divide-y divide-zinc-100 dark:divide-zinc-800/60 animate-pulse p-2">
			{#each Array(3) as _}
				<div class="p-4 space-y-2">
					<div class="flex items-center justify-between">
						<div class="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3"></div>
						<div class="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-12"></div>
					</div>
					<div class="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3"></div>
				</div>
			{/each}
		</div>
	{:else if messages.length === 0}
		<!-- Clean Minimalist Empty State -->
		<div class="flex flex-col items-center justify-center py-16 px-4 text-center my-auto">
			<div class="h-12 w-12 rounded-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center mb-3 text-zinc-400">
				<Inbox class="h-6 w-6" />
			</div>
			<h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Kotak masuk masih kosong</h3>
			<p class="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
				Kirim email ke alamat di atas. Pesan akan otomatis muncul di sini secara realtime.
			</p>
			
			<div class="mt-4 inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
				<span>Auto-sync aktif</span>
			</div>
		</div>
	{:else}
		<!-- Clean Message Feed -->
		<div class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
			{#each messages as msg (msg.id)}
				<button
					onclick={() => onSelect(msg)}
					class="w-full text-left p-4 sm:p-4.5 transition-colors flex items-start justify-between gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 {selectedId === msg.id ? 'bg-indigo-50/60 dark:bg-zinc-800/80' : ''}"
				>
					<div class="flex-1 min-w-0 space-y-1">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
								{msg.from.name || msg.from.address}
							</span>
							<span class="text-[11px] text-zinc-400 shrink-0">
								{formatTimeAgo(msg.receivedAt)}
							</span>
						</div>

						<div class="flex items-center gap-1.5">
							<p class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
								{msg.subject || '(Tanpa Subjek)'}
							</p>
							{#if msg.hasAttachments}
								<Paperclip class="h-3 w-3 text-zinc-400 shrink-0" />
							{/if}
						</div>

						<p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">
							{msg.preview || 'Klik untuk membaca isi email'}
						</p>
					</div>

					<div class="self-center pl-1 text-zinc-300 dark:text-zinc-600">
						<ChevronRight class="h-4 w-4" />
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
