<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	// Open Graph / share-card defaults. Used when individual pages don't
	// override via <svelte:head>. All values lifted from env at build time so
	// production domains preview correctly without code changes.
	const APP_NAME = 'YanzXD Temp';
	const APP_DESC =
		'Disposable temporary email on Cloudflare Pages. One-click inbox, no signup, real-time delivery, export to JSON.';
	const APP_URL_ENV = 'https://yaoi.web.id';
	const APP_PRIMARY = 'https://temp.yaoi.web.id';
	// Use the live custom-domain for og:image so scrapers (WhatsApp, Telegram, X)
	// resolve it correctly. yaoi.web.id apex still initializing in DNS at the moment.
	const OG_IMAGE_HOST = APP_PRIMARY;

	const og = $derived({
		title: `${APP_NAME} — ${APP_PRIMARY === 'https://temp.yaoi.web.id' ? 'Disposable Email' : 'Temp Mail'}`,
		description: APP_DESC,
		url: page.url?.toString() || APP_PRIMARY,
		image: `${OG_IMAGE_HOST}/og-cover.png`,
		imageWidth: 1200,
		imageHeight: 630,
		type: 'website',
		site_name: APP_NAME,
		locale: 'en_US'
	});
</script>

<svelte:head>
	<!-- Primary meta -->
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<meta name="theme-color" content="#6366f1" />
	<meta name="description" content={APP_DESC} />
	<meta name="robots" content="index,follow" />
	<meta name="generator" content="SvelteKit" />

	<!-- Favicons -->
	<link rel="icon" href="https://i.pinimg.com/736x/ca/27/f6/ca27f615c790f1af43f2dd564599bf6a.jpg" type="image/jpeg" />
	<link rel="apple-touch-icon" href="https://i.pinimg.com/736x/ca/27/f6/ca27f615c790f1af43f2dd564599bf6a.jpg" />

	<!-- Open Graph: WhatsApp / Telegram / Discord / Slack / Facebook / LinkedIn -->
	<meta property="og:title" content={og.title} />
	<meta property="og:description" content={og.description} />
	<meta property="og:url" content={og.url} />
	<meta property="og:image" content={og.image} />
	<meta property="og:image:width" content={String(og.imageWidth)} />
	<meta property="og:image:height" content={String(og.imageHeight)} />
	<meta property="og:image:alt" content="YanzXD Temp — disposable email in seconds" />
	<meta property="og:type" content={og.type} />
	<meta property="og:site_name" content={og.site_name} />
	<meta property="og:locale" content={og.locale} />

	<!-- Twitter / X cards -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={og.title} />
	<meta name="twitter:description" content={og.description} />
	<meta name="twitter:image" content={og.image} />
	<meta name="twitter:image:alt" content="YanzXD Temp — disposable email in seconds" />
	<meta name="twitter:site" content="@yanzxd" />

	<!-- Telegram specific -->
	<meta property="telegram:channel" content="@yanzxd" />

	<!-- Brand -->
	<meta name="application-name" content={APP_NAME} />
	<meta name="apple-mobile-web-app-title" content={APP_NAME} />
	<meta name="apple-mobile-web-app-capable" content="yes" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-zinc-50/60 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 selection:bg-indigo-600 selection:text-white transition-colors antialiased">
	<Navbar />

	<main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
		{@render children()}
	</main>

	<Footer />
	<Toast />
</div>
