import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/user_model.dart';

class AuthRepository {
  final Dio _dio = ApiClient().dio;

  Future<UserModel> login(String email, String password) async {
    final response = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final data = response.data as Map<String, dynamic>;
    final token = data['tokens']['accessToken'] as String;
    ApiClient().setToken(token);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<UserModel> register(String name, String email, String password, String? phone) async {
    final response = await _dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
      'phone': phone,
    });
    final data = response.data as Map<String, dynamic>;
    final token = data['tokens']['accessToken'] as String;
    ApiClient().setToken(token);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }
}
