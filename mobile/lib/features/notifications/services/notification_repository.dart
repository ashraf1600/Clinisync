import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/notification_model.dart';

class NotificationRepository {
  final Dio _dio = ApiClient().dio;

  Future<List<NotificationModel>> getNotifications() async {
    final response = await _dio.get('/notifications');
    final items = response.data['items'] as List<dynamic>;
    return items.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markRead(String id) async {
    await _dio.patch('/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _dio.post('/notifications/mark-all-read');
  }
}
