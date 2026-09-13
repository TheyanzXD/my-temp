<script lang="ts">
	import { Code2, Copy, Check, Terminal, ExternalLink } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let copiedSnippet = $state<string | null>(null);

	async function copyCode(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedSnippet = id;
			toasts.add({ title: 'Code copied to clipboard', type: 'success', duration: 1800 });
			setTimeout(() => {
				if (copiedSnippet === id) copiedSnippet = null;
			}, 2000);
		} catch {
			toasts.add({ title: 'Failed to copy', type: 'error' });
		}
	}

	const endpoints = [
		{
			id: 'domains',
			method: 'GET',
			path: '/api/domains',
			description: 'Retrieve list of active domains and mail server statuses.',
			response: `{
  "success": true,
  "data": {
    "domains": [
      {
        "domain": "tempinbox.org",
        "status": "online",
        "availability": true,
        "mxStatus": "active",
        "lastChecked": "2026-09-13T20:00:00Z"
      }
    ]
  }
}`
		},
		{
			id: 'create_mailbox',
			method: 'POST',
			path: '/api/mailbox',
			description: 'Generate a new disposable mailbox with optional custom alias and domain.',
			body: `{
  "username": "custom.name",
  "domain": "tempinbox.org"
}`,
			response: `{
  "success": true,
  "data": {
    "id": "mb_x7k9p2",
    "address": "custom.name@tempinbox.org",
    "domain": "tempinbox.org",
    "createdAt": "2026-09-13T20:30:00.000Z",
    "expiresAt": "2026-09-13T21:30:00.000Z",
    "messageCount": 0
  }
}`
		},
		{
			id: 'get_mailbox',
			method: 'GET',
			path: '/api/mailbox/{address}',
			description: 'Check metadata and expiration of an existing mailbox.',
			response: `{
  "success": true,
  "data": {
    "id": "mb_x7k9p2",
    "address": "custom.name@tempinbox.org",
    "domain": "tempinbox.org",
    "createdAt": "2026-09-13T20:30:00.000Z",
    "expiresAt": "2026-09-13T21:30:00.000Z",
    "messageCount": 1
  }
}`
		},
		{
			id: 'list_messages',
			method: 'GET',
			path: '/api/mailbox/{address}/messages',
			description: 'List all received emails in the mailbox.',
			response: `{
  "success": true,
  "data": {
    "address": "custom.name@tempinbox.org",
    "count": 1,
    "messages": [
      {
        "id": "msg_8u2j1",
        "mailboxId": "mb_x7k9p2",
        "from": {
          "name": "GitHub Security",
          "address": "noreply@github.com"
        },
        "subject": "123456 is your verification code",
        "preview": "Please use the following verification code...",
        "receivedAt": "2026-09-13T20:31:00.000Z",
        "isRead": false,
        "hasAttachments": false
      }
    ]
  }
}`
		},
		{
			id: 'get_message',
			method: 'GET',
			path: '/api/mailbox/{address}/messages/{id}',
			description: 'Retrieve full details and sanitized HTML body of a specific email.',
			response: `{
  "success": true,
  "data": {
    "id": "msg_8u2j1",
    "from": {
      "name": "GitHub Security",
      "address": "noreply@github.com"
    },
    "subject": "123456 is your verification code",
    "textBody": "Hi, your code is 123456...",
    "htmlBody": "<div>Hi, your code is <b>123456</b>...</div>",
    "sanitizedHtml": "<div>Hi, your code is <b>123456</b>...</div>",
    "receivedAt": "2026-09-13T20:31:00.000Z"
  }
}`
		},
		{
			id: 'delete_mailbox',
			method: 'DELETE',
			path: '/api/mailbox/{address}',
			description: 'Immediately destroy a mailbox and purge all associated messages.',
			response: `{
  "success": true,
  "data": {
    "deleted": true,
    "address": "custom.name@tempinbox.org"
  }
}`
		}
	];
</script>

<svelte:head>
	<title>Developer API Documentation — TempMail</title>
	<meta name="description" content="RESTful API documentation for integrating temporary disposable inboxes." />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8 py-4">
	<div>
		<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mb-3">
			<Code2 class="h-3.5 w-3.5 text-zinc-500" />
			<span>RESTful Developer API</span>
		</div>
		<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
			API Reference
		</h1>
		<p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
			Integrate automated disposable email testing directly into your CI/CD workflows and applications.
		</p>
	</div>

	<!-- Quick Curl Example -->
	<div class="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-950 text-zinc-100 space-y-2 font-mono text-xs">
		<div class="flex items-center justify-between text-zinc-400 text-[11px]">
			<div class="flex items-center gap-1.5">
				<Terminal class="h-3.5 w-3.5" />
				<span>Quick Example: Generate inbox via curl</span>
			</div>
			<button
				onclick={() => copyCode('curl', 'curl -X POST http://localhost:5173/api/mailbox')}
				class="hover:text-white transition-colors"
			>
				{#if copiedSnippet === 'curl'}
					<span class="text-emerald-400">Copied!</span>
				{:else}
					<span>Copy</span>
				{/if}
			</button>
		</div>
		<div class="p-2 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 overflow-x-auto select-all">
			curl -X POST http:
		</div>
	</div>

	<!-- Endpoints List -->
	<div class="space-y-6">
		{#each endpoints as ep}
			<div class="p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
				<div class="flex items-center gap-2.5 flex-wrap">
					<span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono {ep.method === 'GET' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : ep.method === 'POST' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}">
						{ep.method}
					</span>
					<span class="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						{ep.path}
					</span>
				</div>

				<p class="text-xs text-zinc-600 dark:text-zinc-400">
					{ep.description}
				</p>

				{#if ep.body}
					<div class="space-y-1">
						<span class="text-[11px] font-medium text-zinc-400">Request Body (JSON)</span>
						<pre class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">{ep.body}</pre>
					</div>
				{/if}

				<div class="space-y-1">
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-medium text-zinc-400">Response (JSON)</span>
						<button
							onclick={() => copyCode(ep.id, ep.response)}
							class="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1"
						>
							{#if copiedSnippet === ep.id}
								<Check class="h-3 w-3 text-emerald-500" />
								<span>Copied</span>
							{:else}
								<Copy class="h-3 w-3" />
								<span>Copy JSON</span>
							{/if}
						</button>
					</div>
					<pre class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">{ep.response}</pre>
				</div>
			</div>
		{/each}
	</div>
</div>
