import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/doctor_model.dart';

class DoctorRepository {
  final Dio _dio = ApiClient().dio;

  Future<List<DoctorModel>> getDoctors({String? specialization, String? search}) async {
    final response = await _dio.get('/doctors', queryParameters: {
      if (specialization != null && specialization.isNotEmpty) 'specialization': specialization,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    final items = response.data['items'] as List<dynamic>;
    return items.map((e) => DoctorModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
