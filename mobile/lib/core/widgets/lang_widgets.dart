import 'package:flutter/material.dart';
import '../i18n/lang.dart';

/// Rebuilding text that follows the global Bangla/English switch.
class T extends StatelessWidget {
  final String bn;
  final String en;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;

  const T(this.bn, this.en, {super.key, this.style, this.textAlign, this.maxLines, this.overflow});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: Lang.code,
      builder: (_, code, __) => Text(
        code == 'bn' ? bn : en,
        style: style,
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: overflow,
      ),
    );
  }
}

/// Language toggle pill (EN | বাংলা), like the website navbar.
class LangToggle extends StatelessWidget {
  const LangToggle({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: Lang.code,
      builder: (_, code, __) => InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: Lang.toggle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.12),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('EN',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: code == 'en' ? Colors.tealAccent : Colors.white60,
                  )),
              const Text(' | ', style: TextStyle(fontSize: 11, color: Colors.white38)),
              Text('বাংলা',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: code == 'bn' ? Colors.tealAccent : Colors.white60,
                  )),
            ],
          ),
        ),
      ),
    );
  }
}
