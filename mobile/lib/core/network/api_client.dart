import 'package:dio/dio.dart';

typedef TokenReader = String? Function();
typedef TokenWriter = void Function(String? access, String? refresh);

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  String? _authToken;
  String? _refreshToken;
  Future<String?>? _refreshing;

  /// Wired by session code so refreshes survive restarts-feel without context.
  TokenReader? readRefreshToken;
  TokenWriter? writeTokens;

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
        onError: (DioException e, handler) async {
          final req = e.requestOptions;
          final isAuthCall = req.path.contains('/auth/login') ||
              req.path.contains('/auth/register') ||
              req.path.contains('/auth/refresh');
          // Silent refresh once per 401 (mirrors the website apiClient)
          if (e.response?.statusCode == 401 && !isAuthCall && !(req.extra['retried'] == true)) {
            req.extra['retried'] = true;
            final fresh = await _refreshAccessToken();
            if (fresh != null) {
              req.headers['Authorization'] = 'Bearer $fresh';
              try {
                final retry = await dio.fetch(req);
                return handler.resolve(retry);
              } catch (_) {
                // fall through to logout below
              }
            }
            setTokens(null, null);
            writeTokens?.call(null, null);
          }
          if (e.response?.statusCode == 401 && isAuthCall) {
            // login itself failed: keep stored tokens untouched
          } else if (e.response?.statusCode == 401) {
            _authToken = null;
          }
          return handler.next(e);
        },
      ),
    );
  }

  Future<String?> _refreshAccessToken() async {
    if (_refreshing != null) return _refreshing;
    final refresh = _refreshToken ?? readRefreshToken?.call();
    if (refresh == null) return null;
    final future = () async {
      try {
        final plain = Dio(BaseOptions(
          baseUrl: dio.options.baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
          headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        ));
        final res = await plain.post('/auth/refresh', data: {'refreshToken': refresh});
        final token = res.data?['accessToken'] as String?;
        if (token == null) return null;
        setTokens(token, refresh);
        writeTokens?.call(token, refresh);
        return token;
      } catch (_) {
        return null;
      } finally {
        _refreshing = null;
      }
    }();
    _refreshing = future;
    return future;
  }

  void setToken(String? token) {
    _authToken = token;
  }

  void setTokens(String? access, String? refresh) {
    _authToken = access;
    _refreshToken = refresh;
  }

  String? get refreshToken => _refreshToken ?? readRefreshToken?.call();

  /// Base origin without /api/v1 — used for QR verify deep links.
  String get origin {
    final base = dio.options.baseUrl;
    if (base.endsWith('/api/v1')) return base.substring(0, base.length - 7);
    if (base.endsWith('/api')) return base.substring(0, base.length - 4);
    return base;
  }
}
