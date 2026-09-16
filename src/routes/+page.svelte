<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mailStore } from '$lib/stores/mail';
	import { formatCountdown } from '$lib/utils';
	import EmailGenerator from '$lib/components/EmailGenerator.svelte';
	import EmailList from '$lib/components/EmailList.svelte';
	import EmailViewer from '$lib/components/EmailViewer.svelte';
	import { RefreshCw, Inbox, Zap, ShieldCheck, Globe } from 'lucide-svelte';

	let countdownText = $state('60:00');
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		mailStore.init();

		countdownInterval = setInterval(() => {
			if ($mailStore.mailbox) {
				const info = formatCountdown($mailStore.mailbox.expiresAt);
				countdownText = info.text;
				if (info.isExpired) {
					mailStore.createMailbox();
				}
			}
		}, 1000);
	});

	onDestroy(() => {
		if (countdownInterval) clearInterval(countdownInterval);
		mailStore.destroy();
	});

	function handleGenerate(username?: string, domain?: string) {
		mailStore.createMailbox(username, domain);
	}

	function handleRefresh() {
		mailStore.fetchMessages();
	}

	function handleDeleteInbox() {
		if (confirm('Hapus kotak masuk ini sekarang? Semua email akan dihapus permanen.')) {
			mailStore.deleteMailbox();
		}
	}
</script>

<svelte:head>
	<title>YanzXD Temp — Temporary Disposable Email</title>
	<meta name="description" content="Layanan temporary email instan, cepat, bersih, dan aman." />
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6">
	<!-- 1. Hero Generator Box with Inline Domain Selector -->
	<EmailGenerator
		currentAddress={$mailStore.mailbox?.address || ''}
		domains={$mailStore.domains}
		expiresAt={$mailStore.mailbox?.expiresAt || ''}
		loading={$mailStore.loading}
		onGenerate={handleGenerate}
		onDelete={handleDeleteInbox}
		onRefresh={handleRefresh}
		{countdownText}
	/>

	<!-- 2. Clean Centered Messages Feed / Reader Area -->
	<div class="space-y-2.5">
		<div class="flex items-center justify-between px-1">
			<div class="flex items-center gap-2">
				<h2 class="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
					<Inbox class="h-3.5 w-3.5 text-indigo-600" />
					<span>Pesan Masuk</span>
				</h2>
				<span class="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
					{$mailStore.messages.length}
				</span>
			</div>

			<button
				onclick={handleRefresh}
				disabled={$mailStore.messagesLoading}
				class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
			>
				<RefreshCw class="h-3 w-3 {$mailStore.messagesLoading ? 'animate-spin' : ''}" />
				<span>Refresh</span>
			</button>
		</div>

		{#if $mailStore.selectedMessage}
			<EmailViewer
				message={$mailStore.selectedMessage}
				onBack={() => mailStore.clearSelectedMessage()}
				onDelete={(id) => mailStore.deleteMessage(id)}
			/>
		{:else}
			<EmailList
				messages={$mailStore.messages}
				selectedId={null}
				loading={$mailStore.messagesLoading}
				onSelect={(msg) => mailStore.selectMessage(msg)}
			/>
		{/if}
	</div>

	<!-- 3. Minimal Clean Feature Footer -->
	<div class="pt-6 border-t border-zinc-200/80 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
		<div class="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-3">
			<div class="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
				<Zap class="h-4 w-4" />
			</div>
			<div class="text-left">
				<h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Realtime Push</h4>
				<p class="text-[11px] text-zinc-400">Email masuk instan via stream SSE.</p>
			</div>
		</div>

		<div class="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-3">
			<div class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
				<ShieldCheck class="h-4 w-4" />
			</div>
			<div class="text-left">
				<h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Anti-Spam & Aman</h4>
				<p class="text-[11px] text-zinc-400">Sanitasi HTML email & auto self-destruct.</p>
			</div>
		</div>

		<div class="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-3">
			<div class="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 shrink-0">
				<Globe class="h-4 w-4" />
			</div>
			<div class="text-left">
				<h4 class="text-xs font-bold text-zinc-900 dark:text-zinc-100">Pilihan Domain</h4>
				<p class="text-[11px] text-zinc-400">Pilih domain langsung di samping email.</p>
			</div>
		</div>
	</div>
</div>
