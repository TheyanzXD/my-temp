import { getMailProvider } from './provider';
import type { Mailbox, EmailMessageSummary, EmailMessageDetail, DomainInfo } from './types';

export async function getDomains(platform?: App.Platform): Promise<DomainInfo[]> {
	const provider = getMailProvider(platform);
	return await provider.getDomains();
}

export async function createMailbox(
	platform: App.Platform | undefined,
	customUsername?: string,
	domain?: string
): Promise<Mailbox> {
	const provider = getMailProvider(platform);
	return await provider.createMailbox(customUsername, domain);
}

export async function getMailbox(platform: App.Platform | undefined, address: string): Promise<Mailbox | null> {
	const provider = getMailProvider(platform);
	return await provider.getMailbox(address);
}

export async function getMessages(platform: App.Platform | undefined, address: string): Promise<EmailMessageSummary[]> {
	const provider = getMailProvider(platform);
	return await provider.getMessages(address);
}

export async function getMessage(
	platform: App.Platform | undefined,
	address: string,
	messageId: string
): Promise<EmailMessageDetail | null> {
	const provider = getMailProvider(platform);
	return await provider.getMessage(address, messageId);
}

export async function deleteMailbox(platform: App.Platform | undefined, address: string): Promise<boolean> {
	const provider = getMailProvider(platform);
	return await provider.deleteMailbox(address);
}

export async function deleteMessage(
	platform: App.Platform | undefined,
	address: string,
	messageId: string
): Promise<boolean> {
	const provider = getMailProvider(platform);
	return await provider.deleteMessage(address, messageId);
}
