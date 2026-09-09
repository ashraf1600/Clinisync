class TimeSlotModel {
  final String startTime;
  final String endTime;
  final bool isAvailable;

  TimeSlotModel({
    required this.startTime,
    required this.endTime,
    required this.isAvailable,
  });

  factory TimeSlotModel.fromJson(Map<String, dynamic> json) {
    return TimeSlotModel(
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
      isAvailable: json['isAvailable'] as bool,
    );
  }
}
