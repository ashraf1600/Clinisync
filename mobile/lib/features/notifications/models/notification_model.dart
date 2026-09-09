class NotificationModel {
  final String id;
  final String title;
  final String body;
  final String notificationType;
  final bool isRead;
  final String createdAt;

  NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.notificationType,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      notificationType: json['notificationType'] as String,
      isRead: json['isRead'] as bool,
      createdAt: json['createdAt'] as String,
    );
  }
}
