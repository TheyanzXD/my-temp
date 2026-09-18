import type { MailProvider } from './types';
import { GuerrillaMailProvider } from './guerrilla-provider';
import { TempMailIoProvider } from './tempmailio-provider';
import { MailGwProvider } from './mailgw-provider';

/**
 * CompositeProvider — atomic snapshot of 3 free public providers. When the
 * active provider runs out (rate limit, domain down), we transparently
 * route the next call to the next provider in the chain. This is what most
 * real "temp mail" aggregators do under the hood.
 *
 * Order tried:
 *   1. mail.tm           (best account model, jwt-backed)
 *   2. temp-mail.io v3   (instant token, 7+ domains, no account pre-create)
 *   3. GuerrillaMail     (sid_token model, multi-domain rotate)
 *
 * Addresses created by one provider cannot be read by another — composite
 * keeps each real provider alive and rotates between them at create time.
 */
export class CompositeProvider implements MailProvider {
	public readonly name = 'Composite (mail.tm + temp-mail.io + guerrilla)';
	private chain: MailProvider[];
	private cursor = 0;

	constructor() {
		this.chain = [new MailGwProvider(), new TempMailIoProvider(), new GuerrillaMailProvider()];
	}

	private pick(): MailProvider {
		return this.chain[this.cursor % this.chain.length];
	}

	private rotate(): void {
		this.cursor = (this.cursor + 1) % this.chain.length;
	}

	async getDomains(): Promise<import('./types').DomainInfo[]> {
		const seen = new Set<string>();
		const all: import('./types').DomainInfo[] = [];
		for (const p of this.chain) {
			try {
				for (const d of await p.getDomains()) {
					if (!seen.has(d.domain)) {
						seen.add(d.domain);
						all.push(d);
					}
				}
			} catch {
				// skip
			}
		}
		return all;
	}

	async createMailbox(customUsername?: string, domain?: string): Promise<import('./types').Mailbox> {
		const errors: unknown[] = [];
		for (let attempt = 0; attempt < this.chain.length; attempt++) {
			const provider = this.pick();
			try {
				return await provider.createMailbox(customUsername, domain);
			} catch (e) {
				errors.push(e);
				this.rotate();
			}
		}
		throw new Error(
			`All composite providers failed: ${errors
				.map((e) => (e instanceof Error ? e.message : String(e)))
				.join('; ')}`
		);
	}

	async getMailbox(address: string) {
		for (const p of this.chain) {
			try {
				const m = await p.getMailbox(address);
				if (m) return m;
			} catch {
				// skip
			}
		}
		return null;
	}

	async getMessages(address: string) {
		for (const p of this.chain) {
			try {
				const msgs = await p.getMessages(address);
				if (msgs.length > 0) return msgs;
			} catch {
				// skip
			}
		}
		return [];
	}

	async getMessage(address: string, messageId: string) {
		for (const p of this.chain) {
			try {
				const m = await p.getMessage(address, messageId);
				if (m) return m;
			} catch {
				// skip
			}
		}
		return null;
	}

	async deleteMailbox(address: string): Promise<boolean> {
		let any = false;
		for (const p of this.chain) {
			try {
				if (await p.deleteMailbox(address)) any = true;
			} catch {
				// skip
			}
		}
		return any;
	}

	async deleteMessage(address: string, messageId: string): Promise<boolean> {
		let any = false;
		for (const p of this.chain) {
			try {
				if (await p.deleteMessage(address, messageId)) any = true;
			} catch {
				// skip
			}
		}
		return any;
	}
}
