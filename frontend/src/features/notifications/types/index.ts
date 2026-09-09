export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  notificationType: string;
  appointmentId?: string;
  isRead: boolean;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
}
