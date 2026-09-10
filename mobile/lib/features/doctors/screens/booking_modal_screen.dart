import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/i18n/lang.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/app_error.dart';
import '../models/doctor_model.dart';
import '../models/appointment_model.dart';
import '../../availability/models/time_slot_model.dart';
import '../../availability/services/availability_repository.dart';
import '../../appointments/services/appointment_repository.dart';

/// Full booking flow mirroring the website BookingPage:
/// doctor card → 7-day strip → slot grid → complaint/type → confirm → QR pass.
class BookingModalScreen extends StatefulWidget {
  final DoctorModel doctor;
  const BookingModalScreen({super.key, required this.doctor});

  @override
  State<BookingModalScreen> createState() => _BookingModalScreenState();
}

class _BookingModalScreenState extends State<BookingModalScreen> {
  final AvailabilityRepository _availRepo = AvailabilityRepository();
  final AppointmentRepository _apptRepo = AppointmentRepository();

  late final List<DateTime> _days =
      List.generate(7, (i) => DateTime.now().add(Duration(days: i)));
  late DateTime _selectedDay = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);

  List<TimeSlotModel> _slots = [];
  TimeSlotModel? _selectedSlot;
  bool _loadingSlots = true;
  bool _isBooking = false;
  String? _error;
  String _visitType = 'new_consultation';
  final _complaint = TextEditingController();
  AppointmentModel? _confirmed;

  @override
  void initState() {
    super.initState();
    _loadSlots();
  }

  @override
  void dispose() {
    _complaint.dispose();
    super.dispose();
  }

  String _dateKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _loadSlots() async {
    setState(() { _loadingSlots = true; _error = null; _selectedSlot = null; });
    try {
      final slots = await _availRepo.getSlots(widget.doctor.id, _dateKey(_selectedDay));
      if (!mounted) return;
      setState(() => _slots = slots);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppError.message(e));
    } finally {
      if (mounted) setState(() => _loadingSlots = false);
    }
  }

  bool _isPastSlot(TimeSlotModel s) {
    final start = DateTime.tryParse(s.startTime)?.toLocal();
    if (start == null) return false;
    final now = DateTime.now();
    final sameDay = start.year == now.year && start.month == now.month && start.day == now.day;
    return sameDay && start.isBefore(now);
  }

  int _durationMin(TimeSlotModel s) {
    final a = DateTime.tryParse(s.startTime);
    final b = DateTime.tryParse(s.endTime);
    if (a == null || b == null) return 0;
    return b.difference(a).inMinutes;
  }

  Future<void> _book() async {
    if (_selectedSlot == null) return;
    setState(() { _isBooking = true; _error = null; });
    try {
      final appt = await _apptRepo.bookAppointment(
        doctorId: widget.doctor.id,
        startTime: _selectedSlot!.startTime,
        endTime: _selectedSlot!.endTime,
        visitType: _visitType,
        chiefComplaint: _complaint.text.trim().isEmpty ? 'Routine medical checkup' : _complaint.text.trim(),
      );
      if (!mounted) return;
      setState(() => _confirmed = appt);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppError.message(e));
      _loadSlots();
    } finally {
      if (mounted) setState(() => _isBooking = false);
    }
  }

  String _fmtSlot(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return DateFormat('hh:mm a').format(dt);
  }

  int get _fee => _visitType == 'followup' ? 800 : widget.doctor.consultationFee.toInt();

  @override
  Widget build(BuildContext context) {
    final doc = widget.doctor;
    if (_confirmed != null) return _passSheet(_confirmed!);

    final freeCount = _slots.where((s) => s.isAvailable && !_isPastSlot(s)).length;
    return Scaffold(
      appBar: AppBar(title: Text(Lang.t('সিরিয়াল বুকিং', 'Book Serial'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: AppColors.primary.withOpacity(0.1),
                      backgroundImage: doc.profilePhotoUrl != null ? NetworkImage(doc.profilePhotoUrl!) : null,
                      child: doc.profilePhotoUrl == null
                          ? Text(doc.name.isNotEmpty ? doc.name[0] : 'D',
                              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 20))
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(doc.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          Text('${doc.specialization} · ${doc.degrees}',
                              style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                          Text('${doc.facility} · ${doc.chamber}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                          const SizedBox(height: 4),
                          Text('৳${doc.consultationFee.toInt()} · ⭐ ${doc.rating} · ${doc.experienceYears}${Lang.t(' বছরের অভিজ্ঞতা', ' yrs exp')}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(Lang.t('📅 দিন বেছে নিন', '📅 Pick a day'),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            SizedBox(
              height: 76,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _days.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final d = _days[i];
                  final sel = _dateKey(d) == _dateKey(_selectedDay);
                  final isToday = i == 0;
                  return InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () {
                      setState(() => _selectedDay = DateTime(d.year, d.month, d.day));
                      _loadSlots();
                    },
                    child: Container(
                      width: 76,
                      decoration: BoxDecoration(
                        color: sel ? AppColors.navyDark : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: sel ? AppColors.navyDark : AppColors.border),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(isToday ? Lang.t('আজ', 'Today') : DateFormat('EEE').format(d),
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold,
                                  color: sel ? Colors.tealAccent : AppColors.textSecondary)),
                          Text(DateFormat('MMM d').format(d),
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900,
                                  color: sel ? Colors.white : AppColors.textPrimary)),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(Lang.t('⏰ ফাঁকা স্লট', 'Free slots'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                  child: Text(Lang.t('$freeCountটি খালি', '$freeCount open'),
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.red.shade200)),
                child: Row(children: [
                  const Icon(Icons.error_outline, size: 16, color: Colors.red),
                  const SizedBox(width: 6),
                  Expanded(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red))),
                  TextButton(onPressed: _loadSlots, child: Text(Lang.t('আবার', 'Retry'))),
                ]),
              ),
            if (_loadingSlots)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (_slots.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(Lang.t('এই দিনে স্লট নেই। অন্য দিন দেখুন।', 'No slots this day. Try another date.'),
                      textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
                ),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3, childAspectRatio: 1.5, crossAxisSpacing: 8, mainAxisSpacing: 8),
                itemCount: _slots.length,
                itemBuilder: (_, i) {
                  final s = _slots[i];
                  final past = _isPastSlot(s);
                  final usable = s.isAvailable && !past;
                  final sel = _selectedSlot?.startTime == s.startTime;
                  final mins = _durationMin(s);
                  return InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: usable ? () => setState(() => _selectedSlot = s) : null,
                    child: Container(
                      decoration: BoxDecoration(
                        color: !usable
                            ? Colors.grey.shade100
                            : sel
                                ? AppColors.primary
                                : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: !usable ? Colors.grey.shade300 : sel ? AppColors.primary : AppColors.primary.withOpacity(0.4),
                            width: sel ? 2 : 1),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(_fmtSlot(s.startTime),
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  color: !usable ? Colors.grey : sel ? Colors.white : AppColors.textPrimary)),
                          Text(
                            past
                                ? Lang.t('সময় পার', 'Passed')
                                : !s.isAvailable
                                    ? Lang.t('বুকড', 'Taken')
                                    : '$mins ${Lang.t('মিনিট', 'min')}',
                            style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: !usable ? Colors.grey : sel ? Colors.white70 : AppColors.primary),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            const SizedBox(height: 14),
            Text(Lang.t('ভিজিটের ধরন', 'Visit type'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'new_consultation', label: Text(Lang.t('নতুন', 'New'), style: const TextStyle(fontSize: 12))),
                ButtonSegment(value: 'followup', label: Text(Lang.t('ফলো-আপ', 'Follow-up'), style: const TextStyle(fontSize: 12))),
              ],
              selected: {_visitType},
              onSelectionChanged: (v) => setState(() => _visitType = v.first),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _complaint,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: Lang.t('সমস্যা / উপসর্গ', 'Complaint / symptoms'),
                hintText: Lang.t('যেমন: বুকে ব্যথা, জ্বর…', 'e.g. chest pain, fever…'),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                onPressed: _selectedSlot == null || _isBooking ? null : _book,
                child: _isBooking
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('${Lang.t('কনফার্ম করুন', 'Confirm')} · ৳$_fee'),
              ),
            ),
            Center(
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(Lang.t('অগ্রিম টাকা লাগবে না — চেম্বারে দেবেন', 'No advance — pay at chamber'),
                    style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  /// Success chamber pass with REAL QR (same verify link as website slip).
  Widget _passSheet(AppointmentModel a) {
    final verifyUrl = '${ApiClient().origin}/#verify/${a.id}';
    return Scaffold(
      appBar: AppBar(title: Text(Lang.t('টোকেন কনফার্মড ✓', 'Token Confirmed ✓'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [AppColors.navyDark, AppColors.primary]),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Center(
                child: Text('#${a.tokenNumber}',
                    style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: Colors.white)),
              ),
            ),
            const SizedBox(height: 10),
            Text(a.doctorName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            Text(a.specialization, style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
            Text('${_fmtSlot(a.startTime)} · ৳${a.fee.toInt()} · ${Lang.t('চেম্বারে পেমেন্ট', 'Pay at chamber')}',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
              child: Column(
                children: [
                  QrImageView(data: verifyUrl, version: QrVersions.auto, size: 190),
                  const SizedBox(height: 6),
                  Text('TOKEN-${a.tokenNumber}',
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 12)),
                  Text(Lang.t('রিসেপশনে স্ক্যান করুন', 'Scan at clinic reception'),
                      style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                child: Text(Lang.t('ডান — ফিরে যান', 'Done — go back')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
