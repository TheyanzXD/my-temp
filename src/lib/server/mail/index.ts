import { getMailProvider } from './provider';
import type { Mailbox, EmailMessageSummary, EmailMessageDetail, DomainInfo } from './types';

export async function getDomains(): Promise<DomainInfo[]> {
	const provider = getMailProvider();
	return await provider.getDomains();
}

export async function createMailbox(customUsername?: string, domain?: string): Promise<Mailbox> {
	const provider = getMailProvider();
	return await provider.createMailbox(customUsername, domain);
}

export async function getMailbox(address: string): Promise<Mailbox | null> {
	const provider = getMailProvider();
	return await provider.getMailbox(address);
}

export async function getMessages(address: string): Promise<EmailMessageSummary[]> {
	const provider = getMailProvider();
	return await provider.getMessages(address);
}

export async function getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null> {
	const provider = getMailProvider();
	return await provider.getMessage(address, messageId);
}

export async function deleteMailbox(address: string): Promise<boolean> {
	const provider = getMailProvider();
	return await provider.deleteMailbox(address);
}

export async function deleteMessage(address: string, messageId: string): Promise<boolean> {
	const provider = getMailProvider();
	return await provider.deleteMessage(address, messageId);
}
