<script lang="ts">
	import type { DomainInfo } from '$lib/server/mail/types';
	import { Copy, RefreshCw, Plus, Check, ChevronDown, Clock, Wand2, ArrowRight } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let {
		currentAddress,
		domains,
		expiresAt,
		loading,
		onGenerate,
		onDelete,
		onRefresh,
		countdownText
	}: {
		currentAddress: string;
		domains: DomainInfo[];
		expiresAt: string;
		loading: boolean;
		onGenerate: (customUser?: string, domain?: string) => void;
		onDelete: () => void;
		onRefresh: () => void;
		countdownText: string;
	} = $props();

	let copied = $state(false);
	let customUser = $state('');
	let showCustomInput = $state(false);

	const currentDomain = $derived(
		currentAddress.includes('@') ? currentAddress.split('@')[1] : domains[0]?.domain || ''
	);

	async function copyAddress() {
		if (!currentAddress) return;
		try {
			await navigator.clipboard.writeText(currentAddress);
			copied = true;
			toasts.add({ title: 'Alamat disalin!', type: 'success', duration: 1800 });
			setTimeout(() => (copied = false), 1800);
		} catch {
			toasts.add({ title: 'Gagal menyalin', type: 'error' });
		}
	}

	function handleGenerateRandom() {
		customUser = '';
		showCustomInput = false;
		onGenerate(undefined, undefined);
	}

	function handleDomainChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const chosenDomain = target.value;
		if (chosenDomain) {
			onGenerate(undefined, chosenDomain);
		}
	}

	function handleCustomSubmit(e: SubmitEvent) {
		e.preventDefault();
		const user = customUser.trim();
		if (!user) {
			toasts.add({ title: 'Masukkan username yang diinginkan', type: 'warning' });
			return;
		}
		onGenerate(user, currentDomain);
		customUser = '';
		showCustomInput = false;
	}
</script>

<!-- Clean Minimalist Hero & Integrated Generator Bar -->
<section class="space-y-4">
	<div class="text-center max-w-xl mx-auto space-y-1.5">
		<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
			Temporary Email, Simple & Private
		</h1>
		<p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
			Dapatkan kotak masuk email sementara instan dan aman.
		</p>
	</div>

	<!-- Main Generator Bar with Inline Domain Selector -->
	<div class="max-w-3xl mx-auto">
		<div class="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
			<div class="flex flex-col sm:flex-row items-center gap-2">
				<!-- Email Address Display + Copy -->
				<div class="flex-1 w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800/80">
					<span class="font-mono text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight select-all">
						{currentAddress || 'Membuat mailbox...'}
					</span>

					<button
						onclick={copyAddress}
						disabled={!currentAddress}
						aria-label="Copy email address"
						class="p-1.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors shrink-0 ml-2"
						title="Salin Alamat"
					>
						{#if copied}
							<Check class="h-4 w-4 text-emerald-500" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</button>
				</div>

				<!-- Inline Domain Selector Dropdown (Di samping Generator) -->
				<div class="w-full sm:w-auto shrink-0">
					<select
						value={currentDomain}
						onchange={handleDomainChange}
						class="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
					>
						{#each domains as d}
							<option value={d.domain}>
								@{d.domain}{(d as { providerLabel?: string }).providerLabel ? ` · ${(d as { providerLabel?: string }).providerLabel}` : ''}
							</option>
						{/each}
					</select>
				</div>

				<!-- Fast Action Buttons -->
				<div class="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
					<button
						onclick={handleGenerateRandom}
						disabled={loading}
						class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs active:scale-98 disabled:opacity-50"
					>
						<Wand2 class="h-3.5 w-3.5" />
						<span>New Address</span>
					</button>

					<button
						onclick={onRefresh}
						disabled={loading}
						aria-label="Refresh inbox"
						class="p-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
						title="Refresh inbox"
					>
						<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
					</button>
				</div>
			</div>

			<!-- Sub toolbar: Countdown Timer & Custom Alias Toggle -->
			<div class="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between px-2 text-[11px]">
				<div class="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
					<Clock class="h-3 w-3 text-indigo-500" />
					<span>Kedaluwarsa dalam: <strong class="font-mono font-bold text-zinc-800 dark:text-zinc-200">{countdownText}</strong></span>
				</div>

				<button
					onclick={() => (showCustomInput = !showCustomInput)}
					class="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1"
				>
					<span>Kustom alias username</span>
					<ChevronDown class="h-3 w-3 transition-transform {showCustomInput ? 'rotate-180' : ''}" />
				</button>
			</div>

			<!-- Custom Alias Input Form -->
			{#if showCustomInput}
				<form onsubmit={handleCustomSubmit} class="mt-2.5 p-3 bg-zinc-50/70 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 space-y-2">
					<div class="flex items-center gap-2">
						<input
							type="text"
							bind:value={customUser}
							placeholder="Masukkan username, cth: john.doe"
							class="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
						<button
							type="submit"
							class="px-3.5 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity shrink-0"
						>
							Set Alias
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</section>
