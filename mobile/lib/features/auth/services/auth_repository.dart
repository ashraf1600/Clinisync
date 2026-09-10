import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/network/api_client.dart';
import '../models/user_model.dart';

/// Session storage mirroring the website localStorage keys + refresh flow.
class SessionStore {
  static const _kAccess = 'access_token';
  static const _kRefresh = 'refresh_token';
  static const _kUser = 'user_data';

  static Future<void> save(String access, String? refresh, UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAccess, access);
    if (refresh != null) await prefs.setString(_kRefresh, refresh);
    await prefs.setString(_kUser, '${user.id}|${user.name}|${user.email}|${user.role}|${user.phone ?? ''}|${user.timezone}');
  }

  static Future<String?> readRefresh() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kRefresh);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kAccess);
    await prefs.remove(_kRefresh);
    await prefs.remove(_kUser);
  }

  static void wire() {
    ApiClient().readRefreshToken = () => ApiClient().refreshToken;
    ApiClient().writeTokens = (access, refresh) async {
      final prefs = await SharedPreferences.getInstance();
      if (access != null) {
        await prefs.setString(_kAccess, access);
      } else {
        await prefs.remove(_kAccess);
        await prefs.remove(_kRefresh);
        await prefs.remove(_kUser);
      }
    };
  }
}

class AuthRepository {
  final Dio _dio = ApiClient().dio;

  Future<UserModel> login(String email, String password) async {
    final response = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return _persist(response.data as Map<String, dynamic>);
  }

  Future<UserModel> register({
    required String name,
    required String email,
    required String password,
    String? phone,
    String role = 'patient',
    String? specialization,
    String? bmdcNumber,
    String? adminInviteCode,
  }) async {
    final response = await _dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'role': role,
      if (specialization != null) 'specialization': specialization,
      if (bmdcNumber != null) 'bmdcNumber': bmdcNumber,
      if (adminInviteCode != null) 'adminInviteCode': adminInviteCode,
    });
    return _persist(response.data as Map<String, dynamic>);
  }

  Future<UserModel> _persist(Map<String, dynamic> data) async {
    final tokens = data['tokens'] as Map<String, dynamic>;
    final access = tokens['accessToken'] as String;
    final refresh = tokens['refreshToken'] as String?;
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    ApiClient().setTokens(access, refresh);
    await SessionStore.save(access, refresh, user);
    return user;
  }

  Future<void> logout() async {
    ApiClient().setTokens(null, null);
    await SessionStore.clear();
  }

  Future<UserModel> me() async {
    final response = await _dio.get('/users/me');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }
}
