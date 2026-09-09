import { apiClient } from '../../../services/api';
import { AdminAnalytics, AuditLogItem } from '../types';

export const adminService = {
  getAnalytics: async (): Promise<AdminAnalytics> => {
    const res = await apiClient.get('/admin/analytics');
    return res.data;
  },
  getAuditLogs: async (params?: { page?: number; pageSize?: number; action?: string }): Promise<{ items: AuditLogItem[] }> => {
    const res = await apiClient.get('/admin/audit-log', { params });
    return res.data;
  },
};
