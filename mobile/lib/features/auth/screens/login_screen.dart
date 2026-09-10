import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/i18n/lang.dart';
import '../../../core/network/app_error.dart';
import '../services/auth_repository.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _repo = AuthRepository();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _isRegister = false;
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  bool get _pwOk {
    final p = _password.text;
    return p.length >= 8 &&
        RegExp(r'[A-Z]').hasMatch(p) &&
        RegExp(r'[a-z]').hasMatch(p) &&
        RegExp(r'[0-9]').hasMatch(p);
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = Lang.t('সঠিক ইমেইল দিন', 'Enter a valid email'));
      return;
    }
    if (_isRegister) {
      if (_name.text.trim().length < 2) {
        setState(() => _error = Lang.t('নাম অন্তত ২ অক্ষরের হতে হবে', 'Name must be 2+ characters'));
        return;
      }
      if (!_pwOk) {
        setState(() => _error = Lang.t('পাসওয়ার্ড: ৮+ অক্ষর, বড়/ছোট + সংখ্যা', 'Password: 8+ chars, upper + lower + number'));
        return;
      }
    }
    if (_password.text.isEmpty) {
      setState(() => _error = Lang.t('পাসওয়ার্ড দিন', 'Enter your password'));
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      if (_isRegister) {
        await _repo.register(
          name: _name.text.trim(),
          email: email,
          password: _password.text,
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        );
      } else {
        await _repo.login(email, _password.text);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = AppError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isRegister ? Lang.t('অ্যাকাউন্ট খুলুন', 'Create Account') : Lang.t('লগইন', 'Log In'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [AppColors.secondary, AppColors.primary]),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Text('🩺', style: TextStyle(fontSize: 34)),
                  SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('CliniSync', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
                      Text('Smart Clinic & Queue', style: TextStyle(fontSize: 10, color: Colors.white70)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.shade200)),
                child: Row(children: [
                  const Icon(Icons.error_outline, size: 16, color: Colors.red),
                  const SizedBox(width: 6),
                  Expanded(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red))),
                  TextButton(
                    onPressed: () => setState(() => _error = null),
                    child: Text(Lang.t('ঠিক আছে', 'OK'), style: const TextStyle(fontSize: 11)),
                  ),
                ]),
              ),
            if (_isRegister)
              TextField(
                  controller: _name,
                  decoration: InputDecoration(
                      labelText: Lang.t('পুরো নাম *', 'Full Name *'),
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.person))),
            if (_isRegister) const SizedBox(height: 12),
            if (_isRegister)
              TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                      labelText: '+880 1XXX-XXXXXX', border: OutlineInputBorder(), prefixIcon: Icon(Icons.phone))),
            if (_isRegister) const SizedBox(height: 12),
            TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                    labelText: Lang.t('ইমেইল *', 'Email *'),
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.email))),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: _obscure,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: Lang.t('পাসওয়ার্ড *', 'Password *'),
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.lock),
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off, size: 20),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
            ),
            if (_isRegister)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: LinearProgressIndicator(
                        value: _password.text.isEmpty
                            ? 0
                            : ((_password.text.length >= 8 ? 1 : 0) +
                                        (RegExp(r'[A-Z]').hasMatch(_password.text) ? 1 : 0) +
                                        (RegExp(r'[a-z]').hasMatch(_password.text) ? 1 : 0) +
                                        (RegExp(r'[0-9]').hasMatch(_password.text) ? 1 : 0)) /
                                4,
                        backgroundColor: Colors.grey.shade200,
                        color: _pwOk ? Colors.green : Colors.amber,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(_pwOk ? Lang.t('শক্তিশালী ✓', 'Strong ✓') : Lang.t('৮+ বড়/ছোট+সংখ্যা', '8+ upper/lower/num'),
                        style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(_isRegister ? Lang.t('অ্যাকাউন্ট খুলুন', 'Create Account') : Lang.t('লগইন', 'Log In')),
              ),
            ),
            TextButton(
              onPressed: () => setState(() { _isRegister = !_isRegister; _error = null; }),
              child: Text(_isRegister
                  ? Lang.t('অ্যাকাউন্ট আছে? লগইন করুন', 'Have an account? Log in')
                  : Lang.t('অ্যাকাউন্ট নেই? রেজিস্টার করুন', "No account? Register")),
            ),
          ],
        ),
      ),
    );
  }
}
