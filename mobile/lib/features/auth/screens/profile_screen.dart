import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/widgets/lang_widgets.dart';
import '../../auth/services/auth_repository.dart';
import '../../auth/services/user_repository.dart';
import '../../auth/models/user_model.dart';
import '../../../core/network/app_error.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _auth = AuthRepository();
  final _users = UserRepository();
  UserModel? _me;
  bool _loading = true;
  String? _error;
  bool _editing = false;
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final me = await _users.getMe();
      if (!mounted) return;
      setState(() {
        _me = me;
        _name.text = me.name;
        _phone.text = me.phone ?? '';
      });
    } catch (e) {
      if (mounted) setState(() => _error = AppError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final me = await _users.updateMe(name: _name.text.trim(), phone: _phone.text.trim());
      if (!mounted) return;
      setState(() { _me = me; _editing = false; });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: T('প্রোফাইল আপডেট হয়েছে ✓', 'Profile updated ✓')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppError.message(e))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _logout() async {
    await _auth.logout();
    if (mounted) Navigator.pop(context, 'logged-out');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const T('আমার প্রোফাইল', 'My Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _load, child: const T('আবার চেষ্টা', 'Retry')),
                    ]),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Center(
                      child: CircleAvatar(
                        radius: 36,
                        backgroundColor: AppColors.primary,
                        child: Text((_me?.name.isNotEmpty ?? false) ? _me!.name[0].toUpperCase() : 'U',
                            style: const TextStyle(fontSize: 28, color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Center(child: Text(_me?.name ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                    Center(child: Text(_me?.email ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
                    Center(
                      child: Container(
                        margin: const EdgeInsets.only(top: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                        child: Text((_me?.role ?? '').toUpperCase(),
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary)),
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (!_editing) ...[
                      _row('📞', _me?.phone?.isNotEmpty ?? false ? _me!.phone! : '—'),
                      _row('🌍', _me?.timezone ?? 'Asia/Dhaka'),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(onPressed: () => setState(() => _editing = true), child: const T('প্রোফাইল এডিট', 'Edit Profile')),
                      ),
                    ] else ...[
                      TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full Name', border: OutlineInputBorder())),
                      const SizedBox(height: 12),
                      TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: '+880 …', border: OutlineInputBorder())),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _saving ? null : _save,
                          child: _saving
                              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const T('সেভ করুন', 'Save'),
                        ),
                      ),
                      TextButton(onPressed: () => setState(() => _editing = false), child: const T('বাদ দিন', 'Cancel')),
                    ],
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.logout, size: 16),
                        label: const T('লগআউট', 'Log Out'),
                        style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red)),
                        onPressed: _logout,
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _row(String icon, String value) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(leading: Text(icon, style: const TextStyle(fontSize: 18)), title: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
    );
  }
}
