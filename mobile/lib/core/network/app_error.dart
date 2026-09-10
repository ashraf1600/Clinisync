import 'dart:io';
import 'package:dio/dio.dart';
import '../i18n/lang.dart';

/// Friendly, bilingual API error messages (mirrors website error envelope UX).
/// Fixes the scary red "Failed host lookup" dump with clear guidance + retry.
class AppError {
  static String message(Object e) {
    if (e is DioException) {
      final code = e.response?.statusCode;
      final data = e.response?.data;
      String? serverMsg;
      if (data is Map) {
        final err = data['error'];
        if (err is Map && err['message'] is String) serverMsg = err['message'] as String;
      }
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.transformTimeout:
          return Lang.t(
            'সার্ভার সাড়া দিচ্ছে না। ইন্টারনেট চেক করে আবার চেষ্টা করুন।',
            'Server is taking too long. Check your internet and retry.',
          );
        case DioExceptionType.connectionError:
          return Lang.t(
            'ইন্টারনেট বা সার্ভারে পৌঁছানো যাচ্ছে না। Wi-Fi/ডাটা চালু করে পুনরায় চেষ্টা করুন।',
            'Cannot reach the server. Turn on Wi-Fi/data and retry.',
          );
        case DioExceptionType.badResponse:
          if (code == 401) {
            return Lang.t('সেশন শেষ হয়ে গেছে। আবার লগইন করুন।', 'Session expired. Please log in again.');
          }
          if (code == 403) {
            return Lang.t('এই কাজের অনুমতি নেই।', 'You are not allowed to do this.');
          }
          if (code == 404) {
            return Lang.t('তথ্য পাওয়া যায়নি।', 'Not found.');
          }
          if (code == 409) {
            return serverMsg ??
                Lang.t('এই স্লটটি এইমাত্র বুক হয়ে গেছে। অন্য সময় বেছে নিন।', 'This slot was just taken. Pick another time.');
          }
          if (code != null && code >= 500) {
            return Lang.t('সার্ভারে সমস্যা হচ্ছে। কিছুক্ষণ পর আবার চেষ্টা করুন।', 'Server trouble. Please try again shortly.');
          }
          return serverMsg ?? Lang.t('কিছু ভুল হয়েছে। আবার চেষ্টা করুন।', 'Something went wrong. Try again.');
        case DioExceptionType.cancel:
          return Lang.t('বাতিল করা হয়েছে।', 'Cancelled.');
        case DioExceptionType.badCertificate:
          return Lang.t('নিরাপদ সংযোগ যাচাই করা যায়নি।', 'Secure connection could not be verified.');
        case DioExceptionType.unknown:
          if (e.error is SocketException) {
            return Lang.t(
              'ইন্টারনেট সংযোগ নেই বা সার্ভার পাওয়া যাচ্ছে না। সংযোগ চেক করে পুনরায় চেষ্টা করুন।',
              'No internet or server unreachable. Check connection and retry.',
            );
          }
          return serverMsg ?? Lang.t('কিছু ভুল হয়েছে। আবার চেষ্টা করুন।', 'Something went wrong. Try again.');
      }
    }
    final s = e.toString().replaceAll('Exception: ', '');
    return s.length > 220 ? '${s.substring(0, 220)}…' : s;
  }
}
