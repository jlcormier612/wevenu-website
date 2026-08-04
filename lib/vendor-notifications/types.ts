export type VendorNotificationType =
  | "new_message"
  | "new_task"
  | "document_shared"
  | "assigned_to_event";

export type VendorNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  emoji: string | null;
  eventId: string | null;
  assignmentId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type VendorNotificationsResponse = {
  notifications: VendorNotification[];
  unreadCount: number;
};
