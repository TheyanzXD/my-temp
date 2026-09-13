<script lang="ts">
	import { HelpCircle, ChevronDown } from 'lucide-svelte';

	let openItem = $state<number | null>(0);

	const faqs = [
		{
			q: 'What is TempMail?',
			a: 'TempMail is a disposable email service that allows you to receive emails at a temporary address that self-destructs after a predetermined time. It helps protect your primary email against spam, bots, and unwanted newsletters.'
		},
		{
			q: 'How long do temporary email addresses last?',
			a: 'By default, every mailbox is active for 60 minutes from creation. You can generate a new mailbox at any time or manually delete an existing mailbox immediately.'
		},
		{
			q: 'Can I choose my own username and domain?',
			a: 'Yes! Open the "Customize domain / alias" dropdown on the generator to choose from our pool of verified domains and enter a custom mailbox name.'
		},
		{
			q: 'Are received emails secure and private?',
			a: 'All incoming emails are automatically sanitized to strip dangerous scripts, tracking beacons, and malicious exploits before rendering. Email records are kept entirely in volatile memory or isolated storage and deleted upon expiration.'
		},
		{
			q: 'Can I send emails from TempMail?',
			a: 'No. TempMail is designed strictly as an inbox-receiving service to prevent spam abuse and maintain high domain deliverability and reputation.'
		},
		{
			q: 'Is there an API available?',
			a: 'Yes, we provide a full REST API for developers to automate disposable inboxes for end-to-end testing, CI/CD pipelines, and app QA. Check the API docs tab for endpoints.'
		}
	];
</script>

<svelte:head>
	<title>FAQ — Frequently Asked Questions — TempMail</title>
	<meta name="description" content="Common questions and answers regarding TempMail temporary disposable mailboxes." />
</svelte:head>

<div class="max-w-3xl mx-auto space-y-8 py-4">
	<div>
		<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mb-3">
			<HelpCircle class="h-3.5 w-3.5 text-zinc-500" />
			<span>Help Center</span>
		</div>
		<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
			Frequently Asked Questions
		</h1>
		<p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
			Everything you need to know about disposable email services and privacy.
		</p>
	</div>

	<div class="space-y-3">
		{#each faqs as item, i}
			<div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
				<button
					onclick={() => (openItem = openItem === i ? null : i)}
					class="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
				>
					<span>{item.q}</span>
					<ChevronDown class="h-4 w-4 text-zinc-400 transition-transform {openItem === i ? 'rotate-180' : ''}" />
				</button>

				{#if openItem === i}
					<div class="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
						{item.a}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
