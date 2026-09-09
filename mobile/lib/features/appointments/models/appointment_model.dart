class AppointmentModel {
  final String id;
  final String patientId;
  final String doctorId;
  final String doctorName;
  final String specialization;
  final int tokenNumber;
  final String startTime;
  final String endTime;
  final String status;
  final String paymentStatus;
  final double fee;
  final String? chiefComplaint;

  AppointmentModel({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.doctorName,
    required this.specialization,
    required this.tokenNumber,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.paymentStatus,
    required this.fee,
    this.chiefComplaint,
  });

  factory AppointmentModel.fromJson(Map<String, dynamic> json) {
    return AppointmentModel(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      doctorId: json['doctorId'] as String,
      doctorName: json['doctorName'] as String,
      specialization: json['specialization'] as String,
      tokenNumber: json['tokenNumber'] as int,
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
      status: json['status'] as String,
      paymentStatus: json['paymentStatus'] as String,
      fee: (json['fee'] as num).toDouble(),
      chiefComplaint: json['chiefComplaint'] as String?,
    );
  }
}
