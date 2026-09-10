import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/i18n/lang.dart';
import '../../../../core/network/app_error.dart';
import '../../../../core/widgets/lang_widgets.dart';
import '../models/notification_model.dart';
import '../services/notification_repository.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  final NotificationRepository _repo = NotificationRepository();
  List<NotificationModel> _notifications = [];
  bool _isLoading = true;
  String? _error;
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final notifs = await _repo.getNotifications();
      final unread = await _repo.getUnreadCount();
      if (!mounted) return;
      setState(() {
        _notifications = notifs;
        _unread = unread;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppError.message(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'booking_confirmed':
        return Icons.confirmation_number;
      case 'queue_update':
        return Icons.update;
      case 'doctor_break':
        return Icons.coffee;
      case 'reminder_24h':
      case 'reminder_1h':
        return Icons.alarm;
      case 'cancelled':
        return Icons.cancel_outlined;
      default:
        return Icons.notifications;
    }
  }

  String _relTime(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final mins = DateTime.now().difference(dt).inMinutes;
    if (mins < 1) return Lang.t('এইমাত্র', 'Just now');
    if (mins < 60) return Lang.t('$mins মিনিট আগে', '$mins m ago');
    final hrs = mins ~/ 60;
    if (hrs < 24) return Lang.t('$hrs ঘণ্টা আগে', '$hrs h ago');
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Text(Lang.t('নোটিফিকেশন', 'Notifications')),
            if (_unread > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: AppColors.amber, borderRadius: BorderRadius.circular(12)),
                child: Text('$_unread ${Lang.t('নতুন', 'new')}',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
            ],
          ],
        ),
        actions: const [Padding(padding: EdgeInsets.only(right: 4), child: LangToggle())],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.signal_wifi_off, size: 40, color: AppColors.textSecondary),
                        const SizedBox(height: 10),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: _load, child: Text(Lang.t('আবার চেষ্টা', 'Retry'))),
                      ],
                    ),
                  ),
                )
              : _notifications.isEmpty
                  ? Center(child: Text(Lang.t('কোনো নোটিফিকেশন নেই।', 'No notifications yet.')))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _notifications.length,
                        itemBuilder: (context, i) {
                          final n = _notifications[i];
                          return Card(
                            color: n.isRead ? Colors.white : AppColors.primary.withOpacity(0.05),
                            margin: const EdgeInsets.only(bottom: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                  color: n.isRead ? Colors.transparent : AppColors.primary.withOpacity(0.3)),
                            ),
                            child: ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                    color: AppColors.primary.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(10)),
                                child: Icon(_iconFor(n.notificationType), color: AppColors.primary, size: 20),
                              ),
                              title: Text(n.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(n.body, style: const TextStyle(fontSize: 12)),
                                  const SizedBox(height: 2),
                                  Text(_relTime(n.createdAt),
                                      style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                                ],
                              ),
                              trailing: n.isRead
                                  ? null
                                  : Container(width: 9, height: 9,
                                      decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                              onTap: () async {
                                if (!n.isRead) {
                                  try {
                                    await _repo.markRead(n.id);
                                  } catch (_) {}
                                  _load();
                                }
                              },
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: _unread > 0
          ? FloatingActionButton.extended(
              icon: const Icon(Icons.done_all, size: 16),
              label: Text(Lang.t('সব পড়ুন', 'Mark all read'), style: const TextStyle(fontSize: 12)),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              onPressed: () async {
                try {
                  await _repo.markAllRead();
                } catch (_) {}
                _load();
              },
            )
          : null,
    );
  }
}
