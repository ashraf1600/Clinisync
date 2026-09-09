import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../models/appointment_model.dart';
import '../services/appointment_repository.dart';

class PatientBookingsScreen extends StatefulWidget {
  const PatientBookingsScreen({super.key});

  @override
  State<PatientBookingsScreen> createState() => _PatientBookingsScreenState();
}

class _PatientBookingsScreenState extends State<PatientBookingsScreen> {
  final AppointmentRepository _repo = AppointmentRepository();
  List<AppointmentModel> _appointments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final appts = await _repo.getMyAppointments();
      setState(() => _appointments = appts);
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Chamber Tokens')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _appointments.isEmpty
              ? const Center(child: Text('No active appointment tokens.'))
              : RefreshIndicator(
                  onRefresh: () => _load(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _appointments.length,
                    itemBuilder: (context, i) {
                      final a = _appointments[i];
                      final when = _fmtWhen(a.startTime);
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.primary.withOpacity(0.12),
                            child: Text(
                              '#${a.tokenNumber}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                            ),
                          ),
                          title: Text(a.doctorName, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${a.specialization} · Pay at chamber (৳${a.fee.toInt()})'),
                              const SizedBox(height: 2),
                              Text(
                                '$when · ${a.status.toUpperCase()}',
                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                          trailing: (a.status == 'cancelled' || a.status == 'completed')
                              ? null
                              : IconButton(
                                  icon: const Icon(Icons.cancel_outlined, color: Colors.red),
                                  tooltip: 'Cancel serial',
                                  onPressed: () async {
                                    await _repo.cancelAppointment(a.id);
                                    _load();
                                  },
                                ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  String _fmtWhen(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final ampm = dt.hour < 12 ? 'AM' : 'PM';
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, $h:$mm $ampm';
  }
}
