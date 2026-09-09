import { apiClient } from '../../../services/api';
import { NotificationListResponse } from '../types';

export const notificationService = {
  getNotifications: async (params?: { page?: number; pageSize?: number; unreadOnly?: boolean }): Promise<NotificationListResponse> => {
    const res = await apiClient.get('/notifications', { params });
    return res.data;
  },
  markRead: async (id: string) => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await apiClient.post('/notifications/mark-all-read');
    return res.data;
  },
};
