import 'package:flutter/foundation.dart';

/// Minimal Bangla/English switch mirroring the website LanguageContext.
/// Default is Bangla, like the web app.
class Lang {
  static final ValueNotifier<String> code = ValueNotifier<String>('bn');

  static bool get isBn => code.value == 'bn';

  static void toggle() => code.value = isBn ? 'en' : 'bn';

  /// Pick the right string for the current language.
  static String t(String bn, String en) => isBn ? bn : en;
}
