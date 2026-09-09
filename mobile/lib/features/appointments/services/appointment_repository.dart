import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/appointment_model.dart';

class AppointmentRepository {
  final Dio _dio = ApiClient().dio;

  Future<AppointmentModel> bookAppointment({
    required String doctorId,
    required String startTime,
    required String endTime,
    String visitType = 'new_consultation',
    String? chiefComplaint,
  }) async {
    final response = await _dio.post('/appointments/book', data: {
      'doctorId': doctorId,
      'startTime': startTime,
      'endTime': endTime,
      'visitType': visitType,
      'chiefComplaint': chiefComplaint,
    });
    return AppointmentModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<AppointmentModel>> getMyAppointments({String filter = 'upcoming'}) async {
    final response = await _dio.get('/appointments/patient/me', queryParameters: {'filter': filter});
    final list = response.data as List<dynamic>;
    return list.map((e) => AppointmentModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> cancelAppointment(String id) async {
    await _dio.put('/appointments/$id/cancel', data: {'reason': 'Patient cancellation'});
  }
}
