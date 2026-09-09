import React, { useEffect, useState } from 'react';
import { X, CheckCheck, Bell, Clock } from 'lucide-react';
import { notificationService } from '../features/notifications/services/notificationService';
import { NotificationItem } from '../features/notifications/types';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshUnread: () => void;
}

export const NotificationDrawer: React.FC<DrawerProps> = ({ isOpen, onClose, onRefreshUnread }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications({ page: 1, pageSize: 20 });
      setNotifications(Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []));
      onRefreshUnread();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    loadNotifications();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-teal-400" />
            <h3 className="font-semibold text-base">Notifications</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-teal-300 hover:text-teal-200 flex items-center space-x-1"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all</span>
            </button>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading alerts...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  n.isRead
                    ? 'bg-slate-50 border-slate-200 opacity-75'
                    : 'bg-teal-50/50 border-teal-200 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-teal-500 mt-1" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p>
                <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-2">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
