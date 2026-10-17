
import { api } from "./api";

export type NotificationItem = {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
};

export const getNotifications = async (
  equbId: string
): Promise<NotificationItem[]> => {
  const response = await api.get<NotificationsResponse>(
    `/notifications?equbId=${encodeURIComponent(equbId)}`
  );

  return response.data.notifications;
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await api.get<{ count: number }>(
    "/notifications/unread-count"
  );

  return response.data.count;
};

export const markNotificationAsRead = async (
  recipientId: string
): Promise<void> => {
  await api.patch(`/notifications/${recipientId}/read`);
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.patch("/notifications/read-all");
};
