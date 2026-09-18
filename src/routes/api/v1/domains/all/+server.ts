import type { RequestHandler } from '@sveltejs/kit';
import { getDomains } from '$lib/server/mail';
import { getMailProvider } from '$lib/server/mail/provider';
import { MailGwProvider } from '$lib/server/mail/mailgw-provider';
import { TempMailIoProvider } from '$lib/server/mail/tempmailio-provider';
import { GuerrillaMailProvider } from '$lib/server/mail/guerrilla-provider';
import { CompositeProvider } from '$lib/server/mail/composite-provider';
import { WebhookMailProvider } from '$lib/server/mail/webhook-provider';
import { MockMailProvider } from '$lib/server/mail/mock-provider';
import type { DomainInfo } from '$lib/server/mail/types';
import { checkRateLimit } from '$lib/server/security';
import { ok, cacheHeaders, err, getIp } from '$lib/server/api/respond';

/**
 * GET /api/v1/domains/all
 *
 * Union of domains from every registered mail provider.
 * Returned rows include a `provider` label so the UI can pick the right
 * owner when the user chooses a domain. Listed providers (each instantiated
 * fresh — no shared state, no side effects):
 *
 *   webhook     · yaoi.web.id, plus whatever is in CUSTOM_DOMAINS env
 *   mailtm      · uberip.com (+ ~1 active rotating)
 *   tempmailio · 7+ public domains: ozsaip, yzcalo, lnovic, ruutukf, …
 *   guerrilla   · guerrillamail.com + 3 rotating siblings
 *   composite   · union of upstream domains
 *   mock        · tempinbox.org, quickmail.dev, disposafast.io, …
 *
 * Each row's `provider` field tells the UI "if the user picks this domain,
 * activate MAIL_PROVIDER=<that-provider> first". For `webhook` it just uses
 * what CUSTOM_DOMAINS already says.
 *
 * Cache: 60s client, 5m edge.
 */

interface DomainRow extends DomainInfo {
	provider: string;
	providerLabel: string;
}

interface ProviderProbe {
	id: string;
	label: string;
	probe: (platform: App.Platform | undefined) => DomainInfo[] | Promise<DomainInfo[]>;
}

const PROBES: ProviderProbe[] = [
	{
		id: 'webhook',
		label: 'CF Email Routing (yaoi.web.id)',
		probe: (p) =>
			new WebhookMailProvider('Cloudflare Email Routing / Webhook', parseCustomDomains(p)).getDomains()
	},
	{
		id: 'mailtm',
		label: 'Mail.tm / Mail.gw',
		probe: () => new MailGwProvider().getDomains()
	},
	{
		id: 'tempmailio',
		label: 'Temp-Mail.io internal API v3',
		probe: () => new TempMailIoProvider().getDomains()
	},
	{
		id: 'guerrilla',
		label: 'GuerrillaMail public AJAX',
		probe: () => new GuerrillaMailProvider().getDomains()
	},
	{
		id: 'composite',
		label: 'Composite chain',
		probe: () => new CompositeProvider().getDomains()
	},
	{
		id: 'mock',
		label: 'KV-backed Demo',
		probe: () => new MockMailProvider().getDomains()
	}
];

function parseCustomDomains(platform?: App.Platform): string[] {
	const env = (platform?.env ?? {}) as Record<string, string | undefined>;
	return (env.CUSTOM_DOMAINS ?? 'yaoi.web.id')
		.split(',')
		.map((d) => d.trim())
		.filter(Boolean);
}

export const GET: RequestHandler = async (event) => {
	const ip = getIp(event);
	const rate = await checkRateLimit(event.platform, ip, 240);
	if (!rate.allowed) return err('RATE_LIMIT_EXCEEDED', 'Too many requests.', 429);

	try {
		const seen = new Set<string>();
		const out: DomainRow[] = [];
		const activeId =
			((event.platform?.env?.MAIL_PROVIDER as string | undefined) ?? 'webhook').toLowerCase();

		// Active provider listed first (so the dropdown anchors on what the
		// deployment actually delivers on).
		const activeProbe = PROBES.find((p) => p.id === activeId);
		if (activeProbe) {
			try {
				const list = await activeProbe.probe(event.platform);
				for (const d of list) {
					if (!seen.has(d.domain)) {
						seen.add(d.domain);
						out.push({ ...d, provider: activeProbe.id, providerLabel: activeProbe.label });
					}
				}
			} catch {
				// active provider unreachable — fall through to the rest
			}
		}

		// Probe the other providers in deterministic order. We time-box the
		// network calls so a slow upstream doesn't stall the request.
		for (const probe of PROBES) {
			if (probe.id === activeId) continue;
			try {
				const list = await Promise.race([
					probe.probe(event.platform),
					new Promise<DomainInfo[]>((resolve) =>
						setTimeout(() => resolve([]), 4000)
					)
				]);
				for (const d of list) {
					if (!seen.has(d.domain)) {
						seen.add(d.domain);
						out.push({ ...d, provider: probe.id, providerLabel: probe.label });
					}
				}
			} catch {
				// skip this provider's domains
			}
		}

		return ok(
			{ domains: out, count: out.length, activeProvider: activeId },
			{ headers: cacheHeaders.public60 }
		);
	} catch (e: unknown) {
		return err('DOMAINS_FETCH_FAILED', e instanceof Error ? e.message : 'Failed to fetch domains', 500);
	}
};
