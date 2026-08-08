export type CoupleNotificationType = "new_message";

export type CoupleNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  conversationId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CoupleNotificationsResponse = {
  notifications: CoupleNotification[];
  unreadCount: number;
};
