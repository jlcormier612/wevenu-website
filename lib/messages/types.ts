export type MessageSenderType = "venue" | "couple";

export type MessageAttachment = {
  id:         string;
  file_url:   string;
  file_name:  string;
  file_size:  number | null;
  mime_type:  string | null;
  created_at: string;
};

export type CoupleMessage = {
  id:             string;
  sender_type:    MessageSenderType;
  body:           string;
  created_at:     string;
  venue_read_at:  string | null;
  couple_read_at: string | null;
  attachments:    MessageAttachment[];
};

export type CoupleThread = {
  id:              string;
  client_id:       string;
  last_message_at: string | null;
  venue_unread:    number;
  couple_unread:   number;
  // Joined from clients
  first_name:       string;
  last_name:        string;
  partner_first_name: string | null;
  partner_last_name:  string | null;
  event_date:       string | null;
  event_type:       string | null;
  latest_message?: {
    body:        string;
    sender_type: MessageSenderType;
    created_at:  string;
  } | null;
};

export type CoupleInbox = {
  threads:      CoupleThread[];
  total_unread: number;
};

export type ThreadDetail = {
  thread:   CoupleThread;
  messages: CoupleMessage[];
};

// Portal-facing (token-scoped; doesn't expose venue internals)
export type PortalThread = {
  thread_id: string;
  messages:  CoupleMessage[];
};
