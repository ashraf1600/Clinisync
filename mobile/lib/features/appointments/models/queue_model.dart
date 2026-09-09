class QueueEntry {
  final String id;
  final int serial;
  final String patientName;
  final String startTime;
  final String endTime;
  final String status;
  final String visitType;

  QueueEntry({
    required this.id,
    required this.serial,
    required this.patientName,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.visitType,
  });

  factory QueueEntry.fromJson(Map<String, dynamic> json) {
    return QueueEntry(
      id: json['id'] as String,
      serial: (json['serial'] ?? json['tokenNumber'] ?? 0) as int,
      patientName: (json['patientName'] ?? 'Patient') as String,
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
      status: (json['status'] ?? 'confirmed') as String,
      visitType: (json['visitType'] ?? 'new_consultation') as String,
    );
  }
}

class DoctorQueue {
  final String date;
  final String doctorName;
  final int? currentRunningSerial;
  final String? currentRunningPatientName;
  final int waitingCount;
  final int completedCount;
  final int totalAppointments;
  final String chamberStatus;
  final bool isPaused;
  final List<QueueEntry> entries;

  DoctorQueue({
    required this.date,
    required this.doctorName,
    required this.currentRunningSerial,
    required this.currentRunningPatientName,
    required this.waitingCount,
    required this.completedCount,
    required this.totalAppointments,
    required this.chamberStatus,
    required this.isPaused,
    required this.entries,
  });

  factory DoctorQueue.fromJson(Map<String, dynamic> json) {
    final raw = (json['items'] ?? json['queue'] ?? []) as List<dynamic>;
    return DoctorQueue(
      date: (json['date'] ?? '') as String,
      doctorName: (json['doctorName'] ?? 'Doctor') as String,
      currentRunningSerial: json['currentRunningSerial'] as int?,
      currentRunningPatientName: json['currentRunningPatientName'] as String?,
      waitingCount: (json['waitingCount'] ?? 0) as int,
      completedCount: (json['completedCount'] ?? 0) as int,
      totalAppointments: (json['totalAppointments'] ?? 0) as int,
      chamberStatus: (json['chamberStatus'] ?? 'IDLE') as String,
      isPaused: (json['isPaused'] ?? false) as bool,
      entries: raw.map((e) => QueueEntry.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
