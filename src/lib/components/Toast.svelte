<script lang="ts">
	import { toasts } from '$lib/stores/toast';
	import { CheckCircle2, AlertCircle, Info, X } from 'lucide-svelte';
</script>

<div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4 sm:p-0">
	{#each $toasts as toast (toast.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 p-4 shadow-lg backdrop-blur-md transition-all duration-200"
			role="alert"
		>
			<div class="mt-0.5 shrink-0">
				{#if toast.type === 'success'}
					<CheckCircle2 class="h-4 w-4 text-emerald-500" />
				{:else if toast.type === 'error'}
					<AlertCircle class="h-4 w-4 text-rose-500" />
				{:else}
					<Info class="h-4 w-4 text-zinc-400" />
				{/if}
			</div>

			<div class="flex-1 min-w-0">
				<p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{toast.title}</p>
				{#if toast.description}
					<p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{toast.description}</p>
				{/if}
			</div>

			<button
				onclick={() => toasts.remove(toast.id)}
				class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 -mr-1 -mt-1 rounded-md transition-colors"
				aria-label="Dismiss"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/each}
</div>
