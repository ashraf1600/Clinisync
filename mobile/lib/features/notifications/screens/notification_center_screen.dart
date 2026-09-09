import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final notifs = await _repo.getNotifications();
      setState(() => _notifications = notifs);
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark all as read',
            onPressed: () async {
              await _repo.markAllRead();
              _load();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? const Center(child: Text('No alerts found.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  itemBuilder: (context, i) {
                    final n = _notifications[i];
                    return Card(
                      color: n.isRead ? Colors.white : AppColors.primary.withOpacity(0.04),
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Icon(
                          n.notificationType == 'booking_confirmed'
                              ? Icons.confirmation_number
                              : Icons.notifications,
                          color: AppColors.primary,
                        ),
                        title: Text(n.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text(n.body, style: const TextStyle(fontSize: 12)),
                        onTap: () async {
                          await _repo.markRead(n.id);
                          _load();
                        },
                      ),
                    );
                  },
                ),
    );
  }
}
