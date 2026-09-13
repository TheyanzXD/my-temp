<script lang="ts">
	import { page } from '$app/stores';
	import { Moon, Sun, Mail, Code2, HelpCircle, Shield, Menu, X, ExternalLink } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let isDark = $state(false);
	let mobileMenuOpen = $state(false);

	onMount(() => {
		const stored = localStorage.getItem('theme');
		if (stored === 'dark') {
			isDark = true;
			document.documentElement.classList.add('dark');
		} else {

			isDark = false;
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	});

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	}

	const navItems = [
		{ href: '/', label: 'Inbox', icon: Mail },
		{ href: '/api-docs', label: 'API Reference', icon: Code2 },
		{ href: '/faq', label: 'FAQ', icon: HelpCircle },
		{ href: '/privacy', label: 'Privacy Policy', icon: Shield }
	];
</script>

<header class="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md transition-colors">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
		<!-- Brand Logo -->
		<a href="/" class="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white group">
			<div class="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold tracking-tight text-sm shadow-sm transition-transform group-hover:scale-105">
				KT
			</div>
			<div class="flex flex-col">
				<span class="tracking-tight text-base font-extrabold text-zinc-900 dark:text-white leading-none">Kyzz Temp</span>
				<span class="text-[10px] text-zinc-400 font-medium leading-tight">Disposable Email</span>
			</div>
		</a>

		<!-- Desktop Navigation (Clean Minimalist) -->
		<nav class="hidden md:flex items-center gap-1.5">
			{#each navItems as item}
				<a
					href={item.href}
					class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {$page.url.pathname === item.href ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/60' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60'}"
				>
					{item.label}
				</a>
			{/each}

			<a
				href="https://github.com"
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors"
			>
				<span>GitHub</span>
				<ExternalLink class="h-3 w-3 opacity-60" />
			</a>
		</nav>

		<!-- Right Controls: Theme Switcher & Hamburger Button -->
		<div class="flex items-center gap-1.5">
			<button
				onclick={toggleTheme}
				aria-label="Toggle theme"
				class="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
			>
				{#if isDark}
					<Sun class="h-4 w-4 text-amber-500" />
				{:else}
					<Moon class="h-4 w-4" />
				{/if}
			</button>

			<!-- Hamburger Toggle Button (Mobile & Tablet) -->
			<button
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-label="Toggle navigation menu"
				class="md:hidden p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
			>
				{#if mobileMenuOpen}
					<X class="h-5 w-5" />
				{:else}
					<Menu class="h-5 w-5" />
				{/if}
			</button>
		</div>
	</div>

	<!-- Mobile Dropdown Drawer Menu -->
	{#if mobileMenuOpen}
		<div class="md:hidden border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-3 space-y-1 shadow-lg">
			{#each navItems as item}
				{@const IconComponent = item.icon}
				<a
					href={item.href}
					onclick={() => (mobileMenuOpen = false)}
					class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors {$page.url.pathname === item.href ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}"
				>
					<IconComponent class="h-4 w-4" />
					<span>{item.label}</span>
				</a>
			{/each}

			<div class="pt-2 border-t border-zinc-100 dark:border-zinc-900">
				<a
					href="https://github.com"
					target="_blank"
					rel="noreferrer"
					class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
				>
					<span>GitHub Repository</span>
					<ExternalLink class="h-3.5 w-3.5 opacity-60" />
				</a>
			</div>
		</div>
	{/if}
</header>
