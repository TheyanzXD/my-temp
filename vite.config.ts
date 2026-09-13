import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		allowedHosts: true
	},
	preview: {
		allowedHosts: true
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter()
		})
	]
});
