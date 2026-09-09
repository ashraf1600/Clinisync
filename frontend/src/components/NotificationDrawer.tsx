import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCheck,
  Bell,
  Clock,
  Ticket,
  RefreshCw,
  Coffee,
  Info,
  XCircle,
} from 'lucide-react';
import { notificationService } from '../features/notifications/services/notificationService';
import { NotificationItem } from '../features/notifications/types';
import { useLanguage } from '../context/LanguageContext';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}

const TYPE_STYLE: Record<string, { icon: React.ElementType; cls: string }> = {
  booking_confirmed: { icon: Ticket, cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  queue_update: { icon: RefreshCw, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  doctor_break: { icon: Coffee, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  reminder_24h: { icon: Clock, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  reminder_1h: { icon: Clock, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cancelled: { icon: XCircle, cls: 'bg-red-50 text-red-600 border-red-200' },
  system: { icon: Info, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const relTime = (iso: string, bn: boolean): string => {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (mins < 1) return bn ? 'এইমাত্র' : 'Just now';
  if (mins < 60) return bn ? `${mins} মিনিট আগে` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return bn ? `${hrs} ঘণ্টা আগে` : `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(bn ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' });
};

export const NotificationDrawer: React.FC<DrawerProps> = ({ isOpen, onClose, onUnreadChange }) => {
  const { language } = useLanguage();
  const bn = language === 'bn';
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications({ page: 1, pageSize: 20 });
      setNotifications(Array.isArray(res?.items) ? res.items : []);
      const count = res?.unreadCount ?? 0;
      setUnread(count);
      onUnreadChange(count);
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
    try {
      await notificationService.markRead(id);
      await loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      await loadNotifications();
    } catch (e) {
      console.error(e);
    }
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
            <h3 className="font-semibold text-base">{bn ? 'নোটিফিকেশন' : 'Notifications'}</h3>
            {unread > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {unread} {bn ? 'নতুন' : 'new'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              className="text-xs text-teal-300 hover:text-teal-200 flex items-center space-x-1 disabled:opacity-40 cursor-pointer"
              title={bn ? 'সব পড়া হিসেবে চিহ্নিত' : 'Mark all as read'}
            >
              <CheckCheck className="w-4 h-4" />
              <span>{bn ? 'সব পড়ুন' : 'Mark all'}</span>
            </button>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {bn ? 'অ্যালার্ট লোড হচ্ছে...' : 'Loading alerts...'}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{bn ? 'কোনো নোটিফিকেশন নেই' : 'No new notifications'}</p>
            </div>
          ) : (
            notifications.map((n) => {
              const style = TYPE_STYLE[n.notificationType] || TYPE_STYLE.system;
              const Icon = style.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    n.isRead
                      ? 'bg-slate-50 border-slate-200 opacity-75'
                      : 'bg-teal-50/50 border-teal-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${style.cls}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-teal-500 mt-1 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed ml-[42px]">{n.body}</p>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-2 ml-[42px]">
                    <Clock className="w-3 h-3" />
                    <span>{relTime(n.createdAt, bn)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
