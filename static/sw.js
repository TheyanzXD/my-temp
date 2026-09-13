const CACHE_NAME = 'tempmail-v1';
const ASSETS_TO_CACHE = [
	'/',
	'/manifest.json',
	'/favicon.svg',
	'/domains',
	'/api-docs',
	'/faq',
	'/privacy'
];

self.addEventListener('install', (event: any) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE);
		})
	);
	(self as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
			);
		})
	);
	(self as any).clients.claim();
});

self.addEventListener('fetch', (event: any) => {
	// Skip API and SSE requests from cache
	if (event.request.url.includes('/api/')) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}
			return fetch(event.request).catch(() => {
				// Offline fallback if needed
				return caches.match('/');
			});
		})
	);
});
