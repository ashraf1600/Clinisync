import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/i18n/lang.dart';
import '../../../../core/network/app_error.dart';
import '../../../../core/widgets/lang_widgets.dart';
import '../models/appointment_model.dart';
import '../services/appointment_repository.dart';
import '../../availability/services/availability_repository.dart';
import '../../availability/models/time_slot_model.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/network/api_client.dart';
import 'package:intl/intl.dart';

class PatientBookingsScreen extends StatefulWidget {
  const PatientBookingsScreen({super.key});

  @override
  State<PatientBookingsScreen> createState() => _PatientBookingsScreenState();
}

class _PatientBookingsScreenState extends State<PatientBookingsScreen> {
  final AppointmentRepository _repo = AppointmentRepository();
  final AvailabilityRepository _avail = AvailabilityRepository();
  List<AppointmentModel> _appointments = [];
  bool _isLoading = true;
  String? _error;
  String _filter = 'upcoming';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final appts = await _repo.getMyAppointments(filter: _filter);
      if (!mounted) return;
      setState(() => _appointments = appts);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppError.message(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _fmtWhen(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    return DateFormat('MMM d, hh:mm a').format(dt);
  }

  Future<void> _cancel(AppointmentModel a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(Lang.t('সিরিয়াল বাতিল?', 'Cancel serial?')),
        content: Text(Lang.t('সিরিয়াল #${a.tokenNumber} বাতিল করতে চান?', 'Cancel serial #${a.tokenNumber}?')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(Lang.t('না', 'No'))),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text(Lang.t('হ্যাঁ', 'Yes'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _repo.cancelAppointment(a.id);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppError.message(e))));
    }
  }

  Future<void> _reschedule(AppointmentModel a) async {
    final newDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (newDate == null || !mounted) return;
    final key = '${newDate.year}-${newDate.month.toString().padLeft(2, '0')}-${newDate.day.toString().padLeft(2, '0')}';
    List<TimeSlotModel> slots = [];
    try {
      slots = (await _avail.getSlots(a.doctorId, key)).where((s) => s.isAvailable).toList();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppError.message(e))));
      return;
    }
    if (slots.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(Lang.t('এই দিনে ফাঁকা স্লট নেই', 'No free slots this day'))),
        );
      }
      return;
    }
    TimeSlotModel? picked;
    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setS) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(Lang.t('নতুন সময় বেছে নিন', 'Pick a new time'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: slots.map((s) {
                    final sel = picked?.startTime == s.startTime;
                    final dt = DateTime.tryParse(s.startTime)?.toLocal();
                    return ChoiceChip(
                      label: Text(dt != null ? DateFormat('hh:mm a').format(dt) : s.startTime),
                      selected: sel,
                      onSelected: (_) => setS(() => picked = s),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: picked == null
                        ? null
                        : () async {
                            try {
                              await _repo.rescheduleAppointment(
                                  id: a.id, newStartTime: picked!.startTime, newEndTime: picked!.endTime);
                              if (mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(Lang.t('সিরিয়াল বদলে গেছে ✓', 'Serial moved ✓'))),
                                );
                                _load();
                              }
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context)
                                    .showSnackBar(SnackBar(content: Text(AppError.message(e))));
                              }
                            }
                          },
                    child: Text(Lang.t('নিশ্চিত করুন', 'Confirm')),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showSlip(AppointmentModel a) {
    final verifyUrl = '${ApiClient().origin}/#verify/${a.id}';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppColors.navyDark, AppColors.primary]),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Center(
                  child: Text('#${a.tokenNumber}',
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 8),
              Text(a.doctorName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              Text('${a.specialization} · ${_fmtWhen(a.startTime)} · ৳${a.fee.toInt()}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              const SizedBox(height: 12),
              QrImageView(data: verifyUrl, version: QrVersions.auto, size: 170),
              Text('TOKEN-${a.tokenNumber}',
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 4),
              Text(Lang.t('রিসেপশনে স্ক্যান করুন · ${a.status}', 'Scan at reception · ${a.status}'),
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(Lang.t('আমার টোকেন', 'My Tokens'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'upcoming', label: Text(Lang.t('আসন্ন', 'Upcoming'))),
                ButtonSegment(value: 'past', label: Text(Lang.t('আগের', 'Past'))),
              ],
              selected: {_filter},
              onSelectionChanged: (v) {
                setState(() => _filter = v.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.signal_wifi_off, size: 40, color: AppColors.textSecondary),
                              const SizedBox(height: 10),
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 12),
                              ElevatedButton(onPressed: _load, child: Text(Lang.t('আবার চেষ্টা', 'Retry'))),
                            ],
                          ),
                        ),
                      )
                    : _appointments.isEmpty
                        ? Center(child: Text(Lang.t('কোনো সিরিয়াল নেই।', 'No serials found.')))
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _appointments.length,
                              itemBuilder: (context, i) {
                                final a = _appointments[i];
                                final active = a.status != 'cancelled' && a.status != 'completed';
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      children: [
                                        CircleAvatar(
                                          radius: 24,
                                          backgroundColor: AppColors.primary.withOpacity(0.12),
                                          child: Text('#${a.tokenNumber}',
                                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 13)),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(a.doctorName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                              Text('${_fmtWhen(a.startTime)} · ${a.status.toUpperCase()}',
                                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                              Text('${a.specialization} · ৳${a.fee.toInt()} · ${Lang.t('চেম্বারে পেমেন্ট', 'Pay at chamber')}',
                                                  style: const TextStyle(fontSize: 11)),
                                            ],
                                          ),
                                        ),
                                        Column(
                                          children: [
                                            IconButton(
                                              icon: const Icon(Icons.qr_code_2, color: AppColors.primary),
                                              tooltip: 'Slip',
                                              onPressed: () => _showSlip(a),
                                            ),
                                            if (active && _filter == 'upcoming')
                                              Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  IconButton(
                                                    icon: const Icon(Icons.edit_calendar, size: 20, color: AppColors.secondary),
                                                    tooltip: 'Reschedule',
                                                    onPressed: () => _reschedule(a),
                                                  ),
                                                  IconButton(
                                                    icon: const Icon(Icons.cancel_outlined, size: 20, color: Colors.red),
                                                    tooltip: 'Cancel',
                                                    onPressed: () => _cancel(a),
                                                  ),
                                                ],
                                              ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
