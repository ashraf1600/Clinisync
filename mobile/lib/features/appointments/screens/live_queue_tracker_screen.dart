import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/i18n/lang.dart';
import '../../../../core/network/app_error.dart';
import '../../../../core/widgets/lang_widgets.dart';
import '../../../../core/widgets/queue_status_badge.dart';
import '../models/appointment_model.dart';
import '../models/queue_model.dart';
import '../services/appointment_repository.dart';

/// Mirrors the website live tracker: full serial list, mine highlighted,
/// running serial, wait estimate, today + my-serial-day chips.
class LiveQueueTrackerScreen extends StatefulWidget {
  const LiveQueueTrackerScreen({super.key});

  @override
  State<LiveQueueTrackerScreen> createState() => _LiveQueueTrackerScreenState();
}

class _LiveQueueTrackerScreenState extends State<LiveQueueTrackerScreen> {
  final AppointmentRepository _repo = AppointmentRepository();

  String get _today => DateFormat('yyyy-MM-dd').format(DateTime.now());

  bool _isLoading = true;
  String? _error;
  List<AppointmentModel> _mine = [];
  String? _doctorId;
  String _trackDate = '';
  DoctorQueue? _queue;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _trackDate = _today;
    _init();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    await _loadMy();
    if (_doctorId != null) {
      await _loadQueue(showSpinner: true);
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 15), (_) {
        if (_trackDate == _today) _loadQueue(showSpinner: false);
      });
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMy() async {
    try {
      final list = await _repo.getMyAppointments(filter: 'upcoming');
      if (!mounted) return;
      final active = list.where((a) => a.status != 'cancelled').toList();
      setState(() {
        _mine = active;
        if (active.isNotEmpty) _doctorId = active.first.doctorId;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppError.message(e));
    }
  }

  Future<void> _loadQueue({required bool showSpinner}) async {
    final doc = _doctorId;
    if (doc == null) return;
    if (showSpinner && mounted) setState(() => _isLoading = true);
    try {
      final q = await _repo.getDoctorQueue(doc, _trackDate);
      if (!mounted) return;
      setState(() {
        _queue = q;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = AppError.message(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _jump(String date) {
    setState(() => _trackDate = date);
    _loadQueue(showSpinner: true);
  }

  String? get _mySerialDate {
    if (_mine.isEmpty) return null;
    try {
      final first = _mine.firstWhere((a) => a.doctorId == _doctorId);
      return first.startTime.substring(0, 10);
    } catch (_) {
      return null;
    }
  }

  int _avgMin() {
    final entries = _queue?.entries ?? [];
    final durs = <int>[];
    for (final e in entries) {
      final s = DateTime.tryParse(e.startTime);
      final t = DateTime.tryParse(e.endTime);
      if (s != null && t != null) {
        final m = t.difference(s).inMinutes;
        if (m > 0 && m < 240) durs.add(m);
      }
    }
    if (durs.isEmpty) return 15;
    final avg = durs.reduce((a, b) => a + b) ~/ durs.length;
    return avg < 5 ? 5 : avg;
  }

  String _fmtTime(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    return DateFormat('hh:mm a').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final queue = _queue;
    final isToday = _trackDate == _today;
    final running = (!isToday) ? null : queue?.currentRunningSerial;

    AppointmentModel? mineToday;
    for (final a in _mine) {
      if (a.doctorId == _doctorId && a.startTime.startsWith(_trackDate)) {
        mineToday = a;
        break;
      }
    }
    mineToday ??= _mine.isNotEmpty ? _mine.first : null;
    final mySerial = mineToday?.tokenNumber;
    final ahead = (mySerial != null && running != null && mySerial > running) ? mySerial - running : 0;
    final isMyTurn = mySerial != null && running != null && mySerial == running;
    final avg = _avgMin();
    final myDate = _mySerialDate;

    return Scaffold(
      appBar: AppBar(
        title: Text(Lang.t('লাইভ সিরিয়াল ট্র্যাকার', 'Live Serial Tracker')),
        actions: [
          const Padding(padding: EdgeInsets.only(right: 4), child: LangToggle()),
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => _loadQueue(showSpinner: true)),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _doctorId == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error ?? Lang.t('কোনো আসন্ন সিরিয়াল নেই। ডাক্তার থেকে বুক করুন।', 'No upcoming serials. Book from Specialists.'),
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _loadQueue(showSpinner: false),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Day chips: today + my serial day
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _dayChip(_today, Lang.t('আজ লাইভ', 'Today Live'), _trackDate == _today, false),
                            if (myDate != null && myDate != _today)
                              _dayChip(myDate, '${Lang.t('আমার দিন', 'My day')} $myDate',
                                  _trackDate == myDate, true),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (_error != null)
                        Container(
                          padding: const EdgeInsets.all(10),
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.red.shade200)),
                          child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red)),
                        ),
                      // My serial hero
                      if (mineToday != null)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            children: [
                              Text(
                                !isToday
                                    ? Lang.t('📅 সিরিয়াল $myDate তারিখের', '📅 Serial is on $myDate')
                                    : isMyTurn
                                        ? Lang.t('🎉 আপনার পালা — ভেতরে যান!', '🎉 Your turn — go in!')
                                        : ahead > 0
                                            ? Lang.t('$ahead জন আগে · ~${ahead * avg} মিনিট',
                                                '$ahead ahead · ~${ahead * avg} min')
                                            : Lang.t('সিরিয়াল কনফার্মড ✓', 'Serial confirmed ✓'),
                                style: const TextStyle(color: Colors.white70, fontSize: 13),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              Text('#$mySerial',
                                  style: const TextStyle(color: Colors.white, fontSize: 56, fontWeight: FontWeight.bold)),
                              Text(mineToday.doctorName,
                                  style: const TextStyle(color: Colors.white70, fontSize: 12), textAlign: TextAlign.center),
                            ],
                          ),
                        ),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    !isToday
                                        ? Lang.t('নির্ধারিত তালিকা', 'Scheduled list')
                                        : running != null
                                            ? '${Lang.t('চলছে', 'Running')}: #$running'
                                            : Lang.t('এখনো শুরু হয়নি', 'Not started yet'),
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  QueueStatusBadge(
                                      status: (queue?.isPaused ?? false)
                                          ? 'paused'
                                          : running != null
                                              ? 'in_queue'
                                              : 'confirmed'),
                                ],
                              ),
                              const Divider(height: 24),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('${Lang.t('অপেক্ষা', 'Waiting')}: ${queue?.waitingCount ?? 0}'),
                                  Text(
                                    '${Lang.t('সম্পন্ন', 'Done')}: ${queue?.completedCount ?? 0}',
                                    style: const TextStyle(color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        isToday
                            ? Lang.t('আজকের কিউ (${queue?.totalAppointments ?? 0})', "Today's queue (${queue?.totalAppointments ?? 0})")
                            : Lang.t('$_trackDate-এর তালিকা (${queue?.totalAppointments ?? 0})', 'List for $_trackDate (${queue?.totalAppointments ?? 0})'),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 8),
                      ...?queue?.entries.map((e) {
                        final isMine = mineToday?.id == e.id;
                        final isRunning = running != null && e.serial == running;
                        return Card(
                          color: isMine
                              ? AppColors.amber.withOpacity(0.15)
                              : isRunning
                                  ? AppColors.primary.withOpacity(0.08)
                                  : Colors.white,
                          margin: const EdgeInsets.only(bottom: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: isMine
                                  ? AppColors.amber
                                  : isRunning
                                      ? AppColors.primary
                                      : Colors.transparent,
                              width: 1.5,
                            ),
                          ),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: isMine
                                  ? AppColors.amber
                                  : isRunning
                                      ? AppColors.primary
                                      : AppColors.background,
                              foregroundColor: (isMine || isRunning) ? Colors.white : AppColors.textPrimary,
                              child: Text('#${e.serial}',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                            title: Text(
                              isMine ? Lang.t('আপনি (আপনার সিরিয়াল)', 'You (Your Serial)') : e.patientName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            subtitle: Text(
                              '${_fmtTime(e.startTime)} · ${e.visitType == 'followup' ? Lang.t('ফলো-আপ', 'Follow-up') : Lang.t('নতুন', 'New')}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: QueueStatusBadge(
                                status: isRunning
                                    ? 'in_queue'
                                    : e.status == 'completed'
                                        ? 'completed'
                                        : 'confirmed'),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
    );
  }

  Widget _dayChip(String date, String label, bool selected, bool mine) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label, style: const TextStyle(fontSize: 12)),
        selected: selected,
        selectedColor: mine ? AppColors.amber : AppColors.navyDark,
        labelStyle: TextStyle(color: selected ? Colors.white : AppColors.textPrimary, fontWeight: FontWeight.bold),
        avatar: mine ? const Icon(Icons.star, size: 14) : null,
        onSelected: (_) => _jump(date),
      ),
    );
  }
}
