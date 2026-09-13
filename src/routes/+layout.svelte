<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen flex flex-col bg-zinc-50/60 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 selection:bg-indigo-600 selection:text-white transition-colors antialiased">
	<Navbar />

	<main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
		{@render children()}
	</main>

	<Footer />
	<Toast />
</div>
