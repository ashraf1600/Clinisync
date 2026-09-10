import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/user_model.dart';

/// Mirrors website ProfileModal (PUT /users/me).
class UserRepository {
  final Dio _dio = ApiClient().dio;

  Future<UserModel> getMe() async {
    final res = await _dio.get('/users/me');
    return UserModel.fromJson(res.data as Map<String, dynamic>);
  }

  Future<UserModel> updateMe({String? name, String? phone, String? timezone}) async {
    final res = await _dio.put('/users/me', data: {
      if (name != null) 'name': name,
      if (phone != null) 'phone': phone,
      if (timezone != null) 'timezone': timezone,
    });
    return UserModel.fromJson(res.data as Map<String, dynamic>);
  }
}
