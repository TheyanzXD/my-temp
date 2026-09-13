export interface DomainInfo {
	domain: string;
	status: 'online' | 'degraded' | 'offline';
	availability: boolean;
	mxStatus: 'active' | 'inactive';
	lastChecked: string;
}

export interface Mailbox {
	id: string;
	address: string;
	domain: string;
	createdAt: string;
	expiresAt: string;
	messageCount: number;
}

export interface EmailSender {
	name?: string;
	address: string;
}

export interface EmailRecipient {
	name?: string;
	address: string;
}

export interface EmailAttachment {
	id: string;
	filename: string;
	contentType: string;
	size: number;
	downloadUrl?: string;
}

export interface EmailMessageSummary {
	id: string;
	mailboxId: string;
	mailboxAddress: string;
	from: EmailSender;
	to: EmailRecipient[];
	subject: string;
	preview: string;
	receivedAt: string;
	isRead: boolean;
	hasAttachments: boolean;
}

export interface EmailMessageDetail extends EmailMessageSummary {
	textBody: string;
	htmlBody: string;
	sanitizedHtml: string;
	rawHeaders?: Record<string, string>;
	attachments: EmailAttachment[];
}

export interface MailProvider {
	readonly name: string;
	getDomains(): Promise<DomainInfo[]>;
	createMailbox(customUsername?: string, domain?: string): Promise<Mailbox>;
	getMailbox(address: string): Promise<Mailbox | null>;
	getMessages(address: string): Promise<EmailMessageSummary[]>;
	getMessage(address: string, messageId: string): Promise<EmailMessageDetail | null>;
	deleteMailbox(address: string): Promise<boolean>;
	deleteMessage(address: string, messageId: string): Promise<boolean>;
}

export type ApiResponse<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: {
				code: string;
				message: string;
				details?: unknown;
			};
	  };
