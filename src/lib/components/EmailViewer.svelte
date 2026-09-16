<script lang="ts">
	import type { EmailMessageDetail } from '$lib/server/mail/types';
	import { formatExactDate } from '$lib/utils';
	import { ArrowLeft, Copy, Check, Trash2, ExternalLink, ShieldCheck, Download, KeyRound, Link as LinkIcon } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let {
		message,
		onBack,
		onDelete
	}: {
		message: EmailMessageDetail;
		onBack: () => void;
		onDelete: (id: string) => void;
	} = $props();

	let copiedKey = $state<string | null>(null);
	// Prefer real HTML, then rendered markdown, last plain text.
	let viewMode: 'html' | 'text' = $state('html');

	const renderedHtml = $derived(message.sanitizedHtml || message.markdownHtml || '');
	const hasValidHtml = $derived(renderedHtml.trim().length > 0 && renderedHtml !== '<pre></pre>');
	const actionables = $derived(message.actionables ?? []);

	async function copyValue(value: string, key: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedKey = key;
			toasts.add({ title: 'Copied to clipboard', type: 'success', duration: 2000 });
			setTimeout(() => (copiedKey = null), 2000);
		} catch {
			toasts.add({ title: 'Failed to copy', type: 'error' });
		}
	}

	function openOriginal() {
		const content = message.htmlBody || message.markdownHtml || message.textBody;
		const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		window.open(url, '_blank');
	}
</script>

<div class="flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
	<!-- Top Bar Navigation -->
	<div class="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap bg-zinc-50/70 dark:bg-zinc-950/60">
		<button
			onclick={onBack}
			class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
		>
			<ArrowLeft class="h-4 w-4" />
			<span>Back to Inbox</span>
		</button>

		<div class="flex items-center gap-2">
			<!-- HTML / Plain Text Toggle -->
			<div class="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-950 text-xs">
				<button
					onclick={() => (viewMode = 'html')}
					class="px-3 py-1.5 rounded-lg font-medium transition-all {viewMode === 'html' ? 'bg-white dark:bg-zinc-800 font-bold text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}"
				>
					Rendered
				</button>
				<button
					onclick={() => (viewMode = 'text')}
					class="px-3 py-1.5 rounded-lg font-medium transition-all {viewMode === 'text' ? 'bg-white dark:bg-zinc-800 font-bold text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}"
				>
					Source
				</button>
			</div>

			<button
				onclick={() => copyValue(message.textBody || message.htmlBody, 'body')}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
				title="Copy email text"
			>
				{#if copiedKey === 'body'}
					<Check class="h-3.5 w-3.5 text-emerald-500" />
					<span class="font-semibold text-emerald-600">Copied</span>
				{:else}
					<Copy class="h-3.5 w-3.5 text-zinc-400" />
					<span>Copy</span>
				{/if}
			</button>

			<button
				onclick={openOriginal}
				class="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
				title="Open in new window"
			>
				<ExternalLink class="h-3.5 w-3.5 text-zinc-400" />
				<span>Raw</span>
			</button>

			<button
				onclick={() => onDelete(message.id)}
				class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shadow-2xs"
				title="Delete message"
			>
				<Trash2 class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Delete</span>
			</button>
		</div>
	</div>

	<!-- Header Info -->
	<div class="p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
		<h2 class="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
			{message.subject || '(No Subject)'}
		</h2>

		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-zinc-50 dark:bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="font-bold text-zinc-500 w-12 shrink-0">From:</span>
					<span class="font-semibold text-zinc-900 dark:text-zinc-100">
						{message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address}
					</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="font-bold text-zinc-500 w-12 shrink-0">To:</span>
					<span class="text-zinc-600 dark:text-zinc-400">
						{message.to.map((t) => t.address).join(', ')}
					</span>
				</div>
			</div>

			<div class="sm:text-right space-y-1 shrink-0">
				<div class="text-zinc-500 dark:text-zinc-400 font-medium">
					{formatExactDate(message.receivedAt)}
				</div>
				<div class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
					<ShieldCheck class="h-3.5 w-3.5" />
					<span>Sanitized Email Sandbox</span>
				</div>
			</div>
		</div>

		<!-- Attachments if any -->
		{#if message.attachments && message.attachments.length > 0}
			<div class="flex items-center gap-2 flex-wrap pt-1">
				{#each message.attachments as att}
					<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200">
						<Download class="h-3.5 w-3.5 text-indigo-500" />
						<span class="font-medium">{att.filename}</span>
						<span class="text-[10px] text-zinc-400">({Math.round(att.size / 1024)} KB)</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Quick actions: OTP codes + verification URLs -->
		{#if actionables.length > 0}
			<div class="flex items-center gap-2 flex-wrap pt-1">
				<span class="text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mr-0.5">
					Detected
				</span>
				{#each actionables as item, i}
					<button
						onclick={() => copyValue(item.value, `act${i}`)}
						title="Copy {item.kind === 'otp' ? 'code' : 'link'}"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-2xs
							{item.kind === 'otp'
							? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
							: 'border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60'}"
					>
						{#if item.kind === 'otp'}
							<KeyRound class="h-3.5 w-3.5" />
						{:else}
							<LinkIcon class="h-3.5 w-3.5" />
						{/if}
						<span class="font-mono">{item.label}</span>
						{#if copiedKey === `act${i}`}
							<Check class="h-3.5 w-3.5 text-emerald-500" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Render Body -->
	<div class="flex-1 p-6 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950/40">
		{#if viewMode === 'html' && hasValidHtml}
			<div class="email-sandbox rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-6 min-h-[300px] shadow-2xs">
				{@html renderedHtml}
			</div>
		{:else if viewMode === 'text'}
			<pre class="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed min-h-[300px] shadow-2xs">
				{message.textBody || message.htmlBody || 'No content available in this email.'}
			</pre>
		{:else}
			<!-- No HTML and no markdown to render: show plain text, still readable. -->
			<div class="email-sandbox whitespace-pre-wrap rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-6 min-h-[300px] shadow-2xs">
				{message.textBody || 'No text content available in this email.'}
			</div>
		{/if}
	</div>
</div>

<style>
	:global(.email-sandbox) {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		color: #18181b;
		word-break: break-word;
		line-height: 1.6;
	}
	:global(.dark .email-sandbox) {
		color: #f4f4f5;
	}
	:global(.email-sandbox a) {
		color: #4f46e5;
		text-decoration: underline;
	}
	:global(.dark .email-sandbox a) {
		color: #818cf8;
	}
	:global(.email-sandbox img) {
		max-width: 100%;
		height: auto;
		border-radius: 6px;
	}
	:global(.email-sandbox code) {
		background: rgba(113, 113, 122, 0.14);
		padding: 0.1em 0.35em;
		border-radius: 4px;
		font-size: 0.9em;
	}
	:global(.email-sandbox blockquote) {
		border-left: 3px solid rgba(99, 102, 241, 0.4);
		padding-left: 0.9em;
		margin: 0.6em 0;
		color: #52525b;
	}
	:global(.dark .email-sandbox blockquote) {
		color: #a1a1aa;
	}
	:global(.email-sandbox ul) {
		list-style: disc;
		padding-left: 1.3em;
		margin: 0.5em 0;
	}
	:global(.email-sandbox h1), :global(.email-sandbox h2), :global(.email-sandbox h3) {
		font-weight: 700;
		margin: 0.7em 0 0.35em;
		line-height: 1.25;
	}
	:global(.email-sandbox h1) { font-size: 1.4em; }
	:global(.email-sandbox h2) { font-size: 1.2em; }
	:global(.email-sandbox h3) { font-size: 1.05em; }
	:global(.email-sandbox hr) {
		border: none;
		border-top: 1px solid rgba(113, 113, 122, 0.3);
		margin: 1em 0;
	}
</style>
