<script lang="ts">
	import { Shield } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Privacy Policy — TempMail</title>
	<meta name="description" content="TempMail privacy policy and data retention principles." />
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6 py-4">
	<div>
		<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mb-3">
			<Shield class="h-3.5 w-3.5 text-zinc-500" />
			<span>Privacy First</span>
		</div>
		<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
			Privacy Policy
		</h1>
		<p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
			We are dedicated to safeguarding your personal data and online privacy.
		</p>
	</div>

	<div class="p-6 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
		<h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. No Personal Information Required</h2>
		<p>
			TempMail does not ask for your name, phone number, physical address, or payment details. No registration or user account creation is ever required to create or receive temporary emails.
		</p>

		<h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. Automatic Expiration and Deletion</h2>
		<p>
			All disposable inboxes and their received email messages are automatically purged from memory and storage after 60 minutes. You can also trigger an immediate manual deletion at any time using the "Delete Mailbox" action.
		</p>

		<h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. Sanitization & Safe Display</h2>
		<p>
			All incoming HTML content is strictly stripped of executable JavaScript, external tracking pixels, and potentially harmful elements to protect your device while browsing received messages.
		</p>
	</div>
</div>
