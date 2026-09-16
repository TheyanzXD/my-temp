// Cloudflare runtime types for SvelteKit `platform` and `platform.env`.
// The @sveltejs/adapter-cloudflare build merges these with its own types,
// so this works in production. Locally, vite still imports the ambient
// SvelteKit Platform type which doesn't have `env`, hence the loose cast
// pattern used in server code (`platform?.env as Env`).

declare global {
	// Minimal Cloudflare Workers ambient types (subset we actually use).
	// D1Database lives here so the ambient platform type in db.ts resolves
	// without pulling all of @cloudflare/workers-types into the root scope
	// (which shadows node/web lib types and breaks 46 unrelated checks).
	interface KVNamespace {
		get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>;
		get<T>(key: string, options: { type: 'json' }): Promise<T | null>;
		put(
			key: string,
			value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
			options?: { expirationTtl?: number; expiration?: number; metadata?: Record<string, unknown> }
		): Promise<void>;
		delete(key: string): Promise<void>;
		list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
			keys: { name: string }[];
			cursor?: string;
			list_complete: boolean;
		}>;
	}

	// D1 (SQLite) ambient type — subset used by db.ts. Only the pieces the app
	// calls; full types ship in @cloudflare/workers-types but are not referenced
	// from the root scope (see comment above on KVNamespace).
	interface D1Result<T = unknown> {
		results?: T[];
		success: boolean;
		meta?: unknown;
	}

	interface D1PreparedStatement {
		bind(...values: unknown[]): D1PreparedStatement;
		first<T = unknown>(): Promise<T | null>;
		all<T = unknown>(): Promise<D1Result<T>>;
		run<T = unknown>(): Promise<D1Result<T>>;
	}

	interface D1Database {
		prepare(query: string): D1PreparedStatement;
		batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
		exec(query: string): Promise<unknown>;
	}

	interface IncomingRequestCfProperties {
		city?: string;
		country?: string;
		continent?: string;
		region?: string;
		regionCode?: string;
		colo?: string;
		asn?: number;
		asOrganization?: string;
		coloLatitude?: number;
		coloLongitude?: number;
		timezone?: string;
		httpProtocol?: string;
		requestPriority?: string;
		clientTrustScore?: number;
		botScore?: number;
	}

	namespace App {
		interface Platform {
			// Cloudflare bindings (declared in wrangler.toml)
			env?: {
				MAILBOX_STORE?: KVNamespace;
				RATE_LIMIT?: KVNamespace;
				MAIL_DB?: D1Database;
				MAIL_PROVIDER?: string;
				MAIL_API_URL?: string;
				MAIL_API_KEY?: string;
				CUSTOM_DOMAINS?: string;
				APP_NAME?: string;
				APP_URL?: string;
				MAILBOX_LIFETIME_MINUTES?: string;
				MAX_REQUESTS_PER_MINUTE?: string;
				CORS_ALLOWED_ORIGINS?: string;
				WEBHOOK_SECRET?: string;
			};
			cf?: IncomingRequestCfProperties;
			ctx?: {
				waitUntil(promise: Promise<unknown>): void;
				passThroughOnException(): void;
			};
			caches?: CacheStorage & { default: Cache };
		}

		interface Env {
			MAILBOX_STORE?: KVNamespace;
			RATE_LIMIT?: KVNamespace;
			MAIL_DB?: D1Database;
			MAIL_PROVIDER?: string;
			MAIL_API_URL?: string;
			MAIL_API_KEY?: string;
			CUSTOM_DOMAINS?: string;
			APP_NAME?: string;
			APP_URL?: string;
			MAILBOX_LIFETIME_MINUTES?: string;
			MAX_REQUESTS_PER_MINUTE?: string;
			CORS_ALLOWED_ORIGINS?: string;
			WEBHOOK_SECRET?: string;
		}
	}
}

export {};
