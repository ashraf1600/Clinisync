export interface AdminAnalytics {
  totalBookings: number;
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
  noShowRatePercentage: number;
  activeDoctors: number;
  registeredPatients: number;
}

export interface AuditLogItem {
  id: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
}
