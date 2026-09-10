import 'package:dio/dio.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  String? _authToken;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        // --dart-define=API_BASE_URL=https://your-api/api/v1 overrides this at build time
        baseUrl: const String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: 'https://clinisync-api.onrender.com/api/v1',
        ),
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
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
