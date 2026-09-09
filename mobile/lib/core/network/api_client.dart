import 'package:dio/dio.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  String? _authToken;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: 'http://10.0.2.2:8000/api/v1', // Android Emulator to host; for web/iOS adjust
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_authToken != null) {
            options.headers['Authorization'] = 'Bearer $_authToken';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) {
          if (e.response?.statusCode == 401) {
            _authToken = null;
          }
          return handler.next(e);
        },
      ),
    );
  }

  void setToken(String? token) {
    _authToken = token;
  }
}
