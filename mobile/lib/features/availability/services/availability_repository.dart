import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/time_slot_model.dart';

class AvailabilityRepository {
  final Dio _dio = ApiClient().dio;

  Future<List<TimeSlotModel>> getSlots(String doctorId, String date, {String? locationId}) async {
    final queryParams = <String, dynamic>{'date': date};
    if (locationId != null) {
      queryParams['locationId'] = locationId;
    }
    final response = await _dio.get('/availability/$doctorId', queryParameters: queryParams);
    final slots = response.data['slots'] as List<dynamic>;
    return slots.map((e) => TimeSlotModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
