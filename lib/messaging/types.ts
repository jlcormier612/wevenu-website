export type MessageChannel = "email" | "sms" | "system" | "internal";
export type MessageDirection = "outbound" | "inbound" | "system";
export type MessageStatus = "draft" | "sending" | "sent" | "delivered" | "failed" | "received";
export type ThreadStatus = "active" | "archived";
export type MessageEntityType = "lead" | "client" | "event";

export type MessageThread = {
  id: string;
  venueId: string;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  subject: string | null;
  channel: MessageChannel;
  status: ThreadStatus;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  // Embedded
  entityName: string | null;   // lead/client display name
  lastMessagePreview: string | null;
  lastMessageDirection: MessageDirection | null;
};

export type Message = {
  id: string;
  threadId: string;
  venueId: string;
  direction: MessageDirection;
  fromName: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  toPhone: string | null;
  subject: string | null;
  body: string;
  bodyHtml: string | null;
  channel: MessageChannel;
  status: MessageStatus;
  providerId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  luvDraftId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ThreadWithMessages = MessageThread & {
  messages: Message[];
};

export type ComposeInput = {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  luvDraftId?: string;
};

export type SendResult =
  | { ok: true; threadId: string; messageId: string }
  | { ok: false; message: string };
