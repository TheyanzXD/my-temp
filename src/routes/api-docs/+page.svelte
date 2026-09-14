<script lang="ts">
	import { Code2, Copy, Check, Terminal, Play, Loader2, ChevronDown, ChevronRight, Server, Webhook, Search } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	type Param = { name: string; in: 'path' | 'query' | 'body'; type: 'string' | 'number' | 'boolean'; required?: boolean; example?: string; description: string; defaultValue?: string };
	type Endpoint = {
		id: string;
		group: 'Core' | 'Mailbox' | 'Messages' | 'Search' | 'Webhook' | 'Utility';
		method: 'GET' | 'POST' | 'DELETE';
		path: string;
		description: string;
		auth?: string;
		params?: Param[];
		bodyExample?: string;
		responseExample: string;
	};

	let copiedSnippet = $state<string | null>(null);
	let expandedId = $state<string | null>(null);
	let activeBaseUrl = $state<string>('');
	let tryingId = $state<string | null>(null);
	let trialResult = $state<Record<string, { status: number; body: string; durationMs: number; ts: number }>>({});
	let paramsInput = $state<Record<string, Record<string, string>>>({});
	let bodyInput = $state<Record<string, string>>({});

	// Set base URL on mount based on current origin
	$effect(() => {
		if (typeof window !== 'undefined' && !activeBaseUrl) {
			activeBaseUrl = window.location.origin;
		}
	});

	async function copyCode(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedSnippet = id;
			toasts.add({ title: 'Copied to clipboard', type: 'success', duration: 1500 });
			setTimeout(() => {
				if (copiedSnippet === id) copiedSnippet = null;
			}, 2000);
		} catch {
			toasts.add({ title: 'Failed to copy', type: 'error' });
		}
	}

	function resolvePath(path: string, params?: Record<string, string>): string {
		let resolved = path;
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				resolved = resolved.replace(`{${k}}`, encodeURIComponent(v || ''));
			}
		}
		return resolved;
	}

	async function runTry(ep: Endpoint) {
		tryingId = ep.id;
		const params = paramsInput[ep.id] ?? {};
		const path = resolvePath(ep.path, params);

		// Separate path params from query params
		const query = new URLSearchParams();
		for (const p of ep.params ?? []) {
			const val = params[p.name];
			if (p.in === 'query' && val) query.set(p.name, val);
		}
		const qs = query.toString();

		const url = `${activeBaseUrl}${path}${qs ? `?${qs}` : ''}`;
		const start = performance.now();
		const init: RequestInit = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
		if (ep.method === 'POST' || ep.method === 'DELETE') {
			const raw = bodyInput[ep.id];
			if (raw && raw.trim()) init.body = raw;
		}

		try {
			const r = await fetch(url, init);
			const text = await r.text();
			const durationMs = Math.round(performance.now() - start);
			let pretty = text;
			try {
				pretty = JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				/* not JSON, keep raw */
			}
			trialResult = { ...trialResult, [ep.id]: { status: r.status, body: pretty, durationMs, ts: Date.now() } };
		} catch (e: unknown) {
			trialResult = {
				...trialResult,
				[ep.id]: {
					status: 0,
					body: `Network error: ${e instanceof Error ? e.message : String(e)}`,
					durationMs: Math.round(performance.now() - start),
					ts: Date.now()
				}
			};
		} finally {
			tryingId = null;
		}
	}

	function getParam(epId: string, name: string): string {
		return (paramsInput[epId] ?? {})[name] ?? '';
	}
	function setParam(epId: string, name: string, value: string) {
		paramsInput = { ...paramsInput, [epId]: { ...(paramsInput[epId] ?? {}), [name]: value } };
	}

	const endpoints: Endpoint[] = [
		// ────────── Core ──────────
		{
			id: 'health',
			group: 'Core',
			method: 'GET',
			path: '/api/health',
			description: 'Liveness probe — no auth, no rate limit. Returns build version and timestamp.',
			responseExample: `{
  "ok": true,
  "service": "my-temp",
  "version": "1.0.0",
  "timestamp": "2026-09-14T10:00:00.000Z",
  "commit": "110eb74"
}`
		},
		{
			id: 'providers',
			group: 'Core',
			method: 'GET',
			path: '/api/v1/providers',
			description: 'List the active mail provider and every provider the build supports, with their prerequisites.',
			responseExample: `{
  "success": true,
  "data": {
    "active": { "id": "webhook", "name": "Cloudflare Email Routing / Webhook" },
    "available": [
      { "id": "webhook", "name": "Cloudflare Email Routing / Webhook", "needs": "Cloudflare Email Routing or ImprovMX/ForwardEmail" },
      { "id": "mock", "name": "KV-backed Demo", "needs": "none" }
    ],
    "customDomains": ["yoai.my.id"]
  }
}`
		},
		{
			id: 'stats',
			group: 'Core',
			method: 'GET',
			path: '/api/v1/stats',
			description: 'Public dashboard stats: active provider, domain health, config limits.',
			responseExample: `{
  "success": true,
  "data": {
    "provider": { "id": "webhook", "name": "Cloudflare Email Routing / Webhook" },
    "domains": { "total": 1, "online": 1 },
    "config": {
      "maxRequestsPerMinute": 120,
      "mailboxLifetimeMinutes": 60,
      "customDomains": ["yoai.my.id"]
    },
    "uptime": { "timestamp": "2026-09-14T10:00:00.000Z" }
  }
}`
		},
		{
			id: 'domains',
			group: 'Core',
			method: 'GET',
			path: '/api/v1/domains',
			description: 'List advertised domains the API can create mailboxes on. Cached at the edge for 5 minutes.',
			responseExample: `{
  "success": true,
  "data": {
    "domains": [
      { "domain": "yoai.my.id", "status": "online", "availability": true, "mxStatus": "active", "lastChecked": "2026-09-14T10:00:00.000Z" }
    ],
    "count": 1
  }
}`
		},

		// ────────── Mailbox ──────────
		{
			id: 'create_mailbox',
			group: 'Mailbox',
			method: 'POST',
			path: '/api/v1/mailbox',
			description: 'Create a new disposable mailbox. Username is optional (random if omitted). Domain is optional (first available if omitted). lifetimeMinutes (1-1440) overrides the default 60-minute expiry.',
			params: [
				{ name: 'username', in: 'body', type: 'string', example: 'alice', description: 'Optional. 2-30 chars; alphanumeric, dots, hyphens, underscores only.' },
				{ name: 'domain', in: 'body', type: 'string', example: 'yoai.my.id', description: 'Optional. Must match one of the advertised domains.' },
				{ name: 'lifetimeMinutes', in: 'body', type: 'number', example: '120', description: 'Optional. 1-1440. Default: 60.' }
			],
			bodyExample: `{\n  "username": "demo",\n  "domain": "yoai.my.id",\n  "lifetimeMinutes": 60\n}`,
			responseExample: `{
  "success": true,
  "data": {
    "id": "mb_hook_abc1234",
    "address": "demo@yoai.my.id",
    "domain": "yoai.my.id",
    "createdAt": "2026-09-14T10:00:00.000Z",
    "expiresAt": "2026-09-14T11:00:00.000Z",
    "messageCount": 0
  }
}`
		},
		{
			id: 'get_mailbox',
			group: 'Mailbox',
			method: 'GET',
			path: '/api/v1/mailbox/{address}',
			description: 'Fetch mailbox metadata (id, expiry, messageCount). Returns 404 once expired.',
			params: [
				{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' }
			],
			responseExample: `{
  "success": true,
  "data": {
    "id": "mb_hook_abc1234",
    "address": "demo@yoai.my.id",
    "domain": "yoai.my.id",
    "createdAt": "2026-09-14T10:00:00.000Z",
    "expiresAt": "2026-09-14T11:00:00.000Z",
    "messageCount": 2
  }
}`
		},
		{
			id: 'delete_mailbox',
			group: 'Mailbox',
			method: 'DELETE',
			path: '/api/v1/mailbox/{address}',
			description: 'Permanently delete a mailbox and all its stored messages.',
			params: [{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' }],
			responseExample: `{ "success": true, "data": { "deleted": true, "address": "demo@yoai.my.id" } }`
		},

		// ────────── Messages ──────────
		{
			id: 'list_messages',
			group: 'Messages',
			method: 'GET',
			path: '/api/v1/mailbox/{address}/messages',
			description: 'List messages for a mailbox. Supports pagination and unread filter.',
			params: [
				{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' },
				{ name: 'unread', in: 'query', type: 'boolean', example: 'true', description: 'Only return unread messages.' },
				{ name: 'limit', in: 'query', type: 'number', example: '50', description: 'Cap to N messages. Max 200.', defaultValue: '200' },
				{ name: 'offset', in: 'query', type: 'number', example: '0', description: 'Skip first N messages.', defaultValue: '0' }
			],
			responseExample: `{
  "success": true,
  "data": {
    "address": "demo@yoai.my.id",
    "total": 2,
    "count": 2,
    "offset": 0,
    "limit": 200,
    "hasMore": false,
    "messages": [
      {
        "id": "msg_inbound_xyz",
        "mailboxId": "mb_hook_abc1234",
        "mailboxAddress": "demo@yoai.my.id",
        "from": { "name": "GitHub Security", "address": "noreply@github.com" },
        "to": [{ "address": "demo@yoai.my.id" }],
        "subject": "Your verification code",
        "preview": "Please use the following verification code...",
        "receivedAt": "2026-09-14T10:01:00.000Z",
        "isRead": false,
        "hasAttachments": false
      }
    ]
  }
}`
		},
		{
			id: 'get_message',
			group: 'Messages',
			method: 'GET',
			path: '/api/v1/mailbox/{address}/messages/{id}',
			description: 'Fetch full message detail including sanitized HTML body and attachment list.',
			params: [
				{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' },
				{ name: 'id', in: 'path', type: 'string', required: true, example: 'msg_inbound_xyz', description: 'Message ID.' }
			],
			responseExample: `{
  "success": true,
  "data": {
    "id": "msg_inbound_xyz",
    "from": { "name": "GitHub Security", "address": "noreply@github.com" },
    "subject": "Your verification code",
    "textBody": "Your code is 123456",
    "htmlBody": "<div>Your code is <b>123456</b></div>",
    "sanitizedHtml": "<div>Your code is <b>123456</b></div>",
    "receivedAt": "2026-09-14T10:01:00.000Z",
    "isRead": true,
    "hasAttachments": false,
    "attachments": []
  }
}`
		},
		{
			id: 'delete_message',
			group: 'Messages',
			method: 'DELETE',
			path: '/api/v1/mailbox/{address}/messages/{id}',
			description: 'Delete one message. Mailbox stays alive.',
			params: [
				{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' },
				{ name: 'id', in: 'path', type: 'string', required: true, example: 'msg_inbound_xyz', description: 'Message ID.' }
			],
			responseExample: `{ "success": true, "data": { "deleted": true, "id": "msg_inbound_xyz" } }`
		},
		{
			id: 'delete_all_messages',
			group: 'Messages',
			method: 'DELETE',
			path: '/api/v1/mailbox/{address}/messages',
			description: 'Delete every message in a mailbox. Mailbox stays alive.',
			params: [{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' }],
			responseExample: `{ "success": true, "data": { "address": "demo@yoai.my.id", "deleted": true, "count": 0 } }`
		},
		{
			id: 'mark_all_read',
			group: 'Messages',
			method: 'POST',
			path: '/api/v1/mailbox/{address}/mark-all-read',
			description: 'Mark every unread message in the mailbox as read. Returns the number of messages updated.',
			params: [{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' }],
			responseExample: `{ "success": true, "data": { "address": "demo@yoai.my.id", "updated": 3 } }`
		},

		// ────────── Search ──────────
		{
			id: 'search',
			group: 'Search',
			method: 'GET',
			path: '/api/v1/mailbox/{address}/search',
			description: 'Substring search across subject, from-address, from-name, and preview. Case-insensitive.',
			params: [
				{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' },
				{ name: 'q', in: 'query', type: 'string', required: true, example: 'github', description: 'Search keyword.' }
			],
			responseExample: `{
  "success": true,
  "data": {
    "address": "demo@yoai.my.id",
    "query": "github",
    "count": 1,
    "messages": []
  }
}`
		},
		{
			id: 'export',
			group: 'Search',
			method: 'GET',
			path: '/api/v1/mailbox/{address}/export',
			description: 'Download all messages. format=jsonl (default) returns one JSON object per line. format=json returns pretty-printed array.',
			params: [
				{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' },
				{ name: 'format', in: 'query', type: 'string', example: 'json', description: '`jsonl` (default) or `json`.', defaultValue: 'jsonl' }
			],
			responseExample: `// Content-Type: application/x-ndjson or application/json
// Content-Disposition: attachment; filename="demo_at_yoai.my.id-2026-09-14.jsonl"`
		},
		{
			id: 'events',
			group: 'Search',
			method: 'GET',
			path: '/api/v1/mailbox/{address}/events',
			description: 'Server-Sent Events stream. Polls KV every 3s and emits `messages` when new mail arrives. Also emits `ping` heartbeats and `mailbox_status` lifecycle events.',
			params: [{ name: 'address', in: 'path', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Full email address.' }],
			responseExample: `event: connected
data: {"address":"demo@yoai.my.id","timestamp":"2026-09-14T10:00:00.000Z"}

event: mailbox_status
data: {"mailbox":{"id":"...","address":"demo@yoai.my.id",...}}

event: messages
data: {"messages":[]}

event: ping
data: {"time":1737000000000}`
		},

		// ────────── Webhook ──────────
		{
			id: 'webhook_inbound',
			group: 'Webhook',
			method: 'POST',
			path: '/api/v1/webhook/inbound',
			description: 'Inbound email webhook receiver. Authenticates via WEBHOOK_SECRET env (sent as `Authorization: Bearer <secret>` or `x-webhook-secret: <secret>`). Auto-creates the mailbox on first delivery.',
			auth: 'WEBHOOK_SECRET',
			params: [
				{ name: 'to', in: 'body', type: 'string', required: true, example: 'demo@yoai.my.id', description: 'Recipient address.' },
				{ name: 'from', in: 'body', type: 'string', required: true, example: 'noreply@github.com', description: 'Sender address.' },
				{ name: 'fromName', in: 'body', type: 'string', example: 'GitHub Security', description: 'Optional display name.' },
				{ name: 'subject', in: 'body', type: 'string', example: 'Your code', description: 'Email subject.' },
				{ name: 'text', in: 'body', type: 'string', example: 'Your code is 123456', description: 'Plain-text body.' },
				{ name: 'html', in: 'body', type: 'string', example: '<p>Your code is <b>123456</b></p>', description: 'HTML body (will be sanitized on render).' }
			],
			bodyExample: `{
  "to": "demo@yoai.my.id",
  "from": "noreply@github.com",
  "fromName": "GitHub Security",
  "subject": "Your verification code",
  "text": "Your code is 123456",
  "html": "<p>Your code is <b>123456</b></p>"
}`,
			responseExample: `{
  "success": true,
  "data": {
    "id": "msg_inbound_xyz",
    "to": "demo@yoai.my.id",
    "subject": "Your verification code",
    "receivedAt": "2026-09-14T10:01:00.000Z"
  }
}`
		}
	];

	const groups = ['Core', 'Mailbox', 'Messages', 'Search', 'Webhook'] as const;
	const methodColors: Record<string, string> = {
		GET: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/60',
		POST: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60',
		DELETE: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/60'
	};
	const groupIcons = {
		Core: Server,
		Mailbox: Server,
		Messages: Webhook,
		Search: Search,
		Webhook: Webhook
	};
</script>

<svelte:head>
	<title>API Reference — MyTemp</title>
	<meta name="description" content="Interactive REST API documentation for MyTemp disposable email service on Cloudflare Pages." />
</svelte:head>

<div class="max-w-5xl mx-auto space-y-8 py-4">
	<header>
		<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mb-3">
			<Code2 class="h-3.5 w-3.5 text-zinc-500" />
			<span>RESTful Developer API · v1</span>
		</div>
		<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">API Reference</h1>
		<p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
			Every endpoint below is callable directly from your browser using the <strong>Try it</strong> panel — it executes a real
			request against <code class="font-mono text-xs px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{activeBaseUrl}</code>
			and shows the live response.
		</p>

		<!-- Quick Curl Card -->
		<div class="mt-5 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-950 text-zinc-100 space-y-2 font-mono text-xs">
			<div class="flex items-center justify-between text-zinc-400 text-[11px]">
				<div class="flex items-center gap-1.5">
					<Terminal class="h-3.5 w-3.5" />
					<span>Quick Example: create inbox via curl</span>
				</div>
				<button onclick={() => copyCode('curl', `curl -X POST ${activeBaseUrl}/api/v1/mailbox \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"demo","domain":"yoai.my.id"}'`)} class="hover:text-white transition-colors inline-flex items-center gap-1">
					{#if copiedSnippet === 'curl'}<Check class="h-3 w-3 text-emerald-400" />Copied!{:else}<Copy class="h-3 w-3" />Copy{/if}
				</button>
			</div>
			<pre class="p-3 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 overflow-x-auto whitespace-pre">curl -X POST {activeBaseUrl}/api/v1/mailbox \
  -H "Content-Type: application/json" \
  -d '{`{"username":"demo","domain":"yoai.my.id"}`}'</pre>
		</div>
	</header>

	<!-- Endpoints grouped -->
	{#each groups as group}
		{@const groupEndpoints = endpoints.filter((e) => e.group === group)}
		{@const GroupIcon = groupIcons[group]}
		{#if groupEndpoints.length}
			<section class="space-y-4">
				<div class="flex items-center gap-2">
					<GroupIcon class="h-4 w-4 text-zinc-400" />
					<h2 class="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{group}</h2>
					<span class="text-[11px] text-zinc-400">· {groupEndpoints.length} endpoint{groupEndpoints.length === 1 ? '' : 's'}</span>
				</div>

				<div class="space-y-3">
					{#each groupEndpoints as ep}
						<div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
							<button
								type="button"
								onclick={() => (expandedId = expandedId === ep.id ? null : ep.id)}
								class="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
							>
								{#if expandedId === ep.id}
									<ChevronDown class="h-4 w-4 text-zinc-400 shrink-0" />
								{:else}
									<ChevronRight class="h-4 w-4 text-zinc-400 shrink-0" />
								{/if}
								<span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono border {methodColors[ep.method]}">{ep.method}</span>
								<code class="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{ep.path}</code>
								{#if ep.auth}
									<span class="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">auth: {ep.auth}</span>
								{/if}
							</button>

							<div class="px-4 pb-4 pt-1 space-y-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
								<p class="text-xs text-zinc-600 dark:text-zinc-400">{ep.description}</p>

								<!-- Parameters -->
								{#if ep.params && ep.params.length}
									<div class="space-y-2">
										<span class="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Parameters</span>
										<div class="overflow-hidden rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
											<table class="w-full text-xs">
												<thead class="bg-zinc-50 dark:bg-zinc-950">
													<tr class="text-left text-zinc-500">
														<th class="px-3 py-2 font-medium">Name</th>
														<th class="px-3 py-2 font-medium">In</th>
														<th class="px-3 py-2 font-medium">Type</th>
														<th class="px-3 py-2 font-medium">Description</th>
													</tr>
												</thead>
												<tbody class="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
													{#each ep.params as p}
														<tr>
															<td class="px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
																{p.name}{#if p.required}<span class="text-rose-500 ml-0.5">*</span>{/if}
															</td>
															<td class="px-3 py-2"><span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{p.in}</span></td>
															<td class="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{p.type}</td>
															<td class="px-3 py-2 text-zinc-600 dark:text-zinc-400">{p.description}{#if p.defaultValue} <span class="text-zinc-400">(default: <code class="font-mono">{p.defaultValue}</code>)</span>{/if}</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								{/if}

								<!-- Try it panel -->
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-[11px] font-medium text-zinc-400 uppercase tracking-wider inline-flex items-center gap-1.5">
											<Play class="h-3 w-3" />Try it
										</span>
									</div>

									<div class="p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-950 space-y-2">
										<!-- Path/Body inputs -->
										{#if ep.params && ep.params.length}
											<div class="grid sm:grid-cols-2 gap-2">
												{#each ep.params.filter((p) => p.in === 'path' || p.in === 'query') as p}
													<label class="block">
														<span class="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{p.name} <span class="text-zinc-400">({p.in}{p.required ? ', required' : ''})</span></span>
														<input
															type="text"
															value={getParam(ep.id, p.name) || (p.example ?? '')}
															oninput={(e) => setParam(ep.id, p.name, (e.currentTarget as HTMLInputElement).value)}
															placeholder={p.example ?? ''}
															class="w-full mt-1 px-2 py-1.5 rounded border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
														/>
													</label>
												{/each}
											</div>
										{/if}

										{#if ep.method === 'POST' || ep.method === 'DELETE'}
											{#if ep.bodyExample || (ep.params ?? []).some((p) => p.in === 'body')}
												<label class="block">
													<span class="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Request Body (JSON)</span>
													<textarea
														value={bodyInput[ep.id] ?? ep.bodyExample ?? '{}'}
														oninput={(e) => (bodyInput = { ...bodyInput, [ep.id]: (e.currentTarget as HTMLTextAreaElement).value })}
														rows={6}
														class="w-full mt-1 px-2 py-1.5 rounded border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
													></textarea>
												</label>
											{/if}
										{/if}

										<div class="flex items-center justify-between gap-2 pt-1">
											<code class="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
												<span class="font-bold {ep.method === 'GET' ? 'text-blue-500' : ep.method === 'POST' ? 'text-emerald-500' : 'text-rose-500'}">{ep.method}</span>
												{resolvePath(ep.path, paramsInput[ep.id] ?? {})}
											</code>
											<button
												onclick={() => runTry(ep)}
												disabled={tryingId === ep.id}
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
											>
												{#if tryingId === ep.id}
													<Loader2 class="h-3 w-3 animate-spin" />Sending…
												{:else}
													<Play class="h-3 w-3" />Send
												{/if}
											</button>
										</div>
									</div>

									<!-- Trial result -->
									{#if trialResult[ep.id]}
										{@const r = trialResult[ep.id]}
										<div class="rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
											<div class="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-[11px]">
												<div class="flex items-center gap-2">
													<span class="font-mono font-bold {r.status >= 200 && r.status < 300 ? 'text-emerald-600 dark:text-emerald-400' : r.status >= 400 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}">
														{r.status === 0 ? 'NETWORK ERROR' : `HTTP ${r.status}`}
													</span>
													<span class="text-zinc-500">{r.durationMs} ms</span>
												</div>
												<button onclick={() => copyCode(`trial-${ep.id}`, r.body)} class="text-zinc-500 hover:text-zinc-900 dark:hover:text-white inline-flex items-center gap-1">
													{#if copiedSnippet === `trial-${ep.id}`}<Check class="h-3 w-3 text-emerald-500" />Copied{:else}<Copy class="h-3 w-3" />Copy{/if}
												</button>
											</div>
											<pre class="p-3 text-xs font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 overflow-x-auto max-h-80">{r.body}</pre>
										</div>
									{/if}
								</div>

								<!-- Example response -->
								<div class="space-y-2 pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40">
									<div class="flex items-center justify-between">
										<span class="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Example Response</span>
										<button onclick={() => copyCode(`ex-${ep.id}`, ep.responseExample)} class="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1">
											{#if copiedSnippet === `ex-${ep.id}`}<Check class="h-3 w-3 text-emerald-500" />Copied{:else}<Copy class="h-3 w-3" />Copy{/if}
										</button>
									</div>
									<pre class="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">{ep.responseExample}</pre>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/each}

	<!-- Rate limits / response shape -->
	<section class="grid sm:grid-cols-2 gap-3">
		<div class="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
			<h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Rate limits</h3>
			<ul class="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
				<li>• Read endpoints — <code class="font-mono">240 req/min/IP</code></li>
				<li>• Mailbox creation — <code class="font-mono">30 req/min/IP</code></li>
				<li>• Delete operations — <code class="font-mono">60 req/min/IP</code></li>
				<li>• Inbound webhook — <code class="font-mono">120 req/min/IP</code></li>
				<li>• Over-quota returns <code class="font-mono">429</code> with <code class="font-mono">Retry-After</code></li>
			</ul>
		</div>
		<div class="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
			<h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Response shape</h3>
			<pre class="text-xs font-mono text-zinc-700 dark:text-zinc-300">{`// success
{ "success": true, "data": { ... } }

// error
{
  "success": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Invalid email address",
    "details": null
  }
}`}</pre>
		</div>
	</section>
</div>
