import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../services/auth_repository.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _repo = AuthRepository();
  final _email = TextEditingController(text: 'patient@example.com');
  final _password = TextEditingController(text: 'Password123!');
  final _name = TextEditingController();
  bool _isRegister = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try {
      if (_isRegister) {
        if (_name.text.trim().length < 2) throw Exception('Name too short');
        await _repo.register(_name.text.trim(), _email.text.trim(), _password.text, null);
      } else {
        await _repo.login(_email.text.trim(), _password.text);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = e.toString().replace('Exception: ', '').replace('DioException', 'Network error'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isRegister ? 'Create Account' : 'Log In')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Icon(Icons.medical_services, size: 56, color: AppColors.primary),
            const SizedBox(height: 8),
            const Text('CliniSync', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(_isRegister ? 'Patient registration — instant serial access' : 'Log in to book & track your serials',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12), textAlign: TextAlign.center),
            const SizedBox(height: 20),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.red.shade200)),
                child: Row(children: [const Icon(Icons.error_outline, size: 16, color: Colors.red), const SizedBox(width: 6), Expanded(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red)))]),
              ),
            const SizedBox(height: 12),
            if (_isRegister)
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full Name', border: OutlineInputBorder(), prefixIcon: Icon(Icons.person))),
            if (_isRegister) const SizedBox(height: 12),
            TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder(), prefixIcon: Icon(Icons.email))),
            const SizedBox(height: 12),
            TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder(), prefixIcon: Icon(Icons.lock))),
            const SizedBox(height: 8),
            const Text('8+ chars, upper + lower + number', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                onPressed: _loading ? null : _submit,
                child: _loading ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(_isRegister ? 'Create Account' : 'Log In'),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => setState(() => _isRegister = !_isRegister),
              child: Text(_isRegister ? 'Already have an account? Log In' : "Don't have an account? Register"),
            ),
          ],
        ),
      ),
    );
  }
}
