import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/queue_status_badge.dart';
import '../models/appointment_model.dart';
import '../models/queue_model.dart';
import '../services/appointment_repository.dart';

class LiveQueueTrackerScreen extends StatefulWidget {
  const LiveQueueTrackerScreen({super.key});

  @override
  State<LiveQueueTrackerScreen> createState() => _LiveQueueTrackerScreenState();
}

class _LiveQueueTrackerScreenState extends State<LiveQueueTrackerScreen> {
  final AppointmentRepository _repo = AppointmentRepository();
  final String _today = DateFormat('yyyy-MM-dd').format(DateTime.now());

  bool _isLoading = true;
  String? _error;
  AppointmentModel? _myAppt;
  DoctorQueue? _queue;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load(showSpinner: true);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load(showSpinner: false));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({required bool showSpinner}) async {
    if (showSpinner) setState(() => _isLoading = true);
    try {
      final mine = await _repo.getMyAppointments(filter: 'upcoming');
      final active = mine.where((a) => a.status != 'cancelled').toList();
      AppointmentModel? mineToday;
      for (final a in active) {
        if (a.startTime.startsWith(_today)) {
          mineToday = a;
          break;
        }
      }
      final tracked = mineToday ?? (active.isNotEmpty ? active.first : null);
      DoctorQueue? queue;
      if (tracked != null) {
        queue = await _repo.getDoctorQueue(tracked.doctorId, _today);
      }
      if (mounted) {
        setState(() {
          _myAppt = tracked;
          _queue = queue;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int _avgSlotMin() {
    final entries = _queue?.entries ?? [];
    final durs = entries.map((e) {
      final s = DateTime.tryParse(e.startTime);
      final t = DateTime.tryParse(e.endTime);
      if (s == null || t == null) return 0;
      return t.difference(s).inMinutes;
    }).where((m) => m > 0 && m < 240).toList();
    if (durs.isEmpty) return 15;
    final avg = durs.reduce((a, b) => a + b) ~/ durs.length;
    return avg < 5 ? 5 : avg;
  }

  @override
  Widget build(BuildContext context) {
    final queue = _queue;
    final mine = _myAppt;
    final running = queue?.currentRunningSerial;
    final mySerial = mine?.tokenNumber;
    final ahead = (mySerial != null && running != null && mySerial > running) ? mySerial - running : 0;
    final isMyTurn = mySerial != null && running != null && mySerial == running;
    final avg = _avgSlotMin();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Chamber Queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => _load(showSpinner: true),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && queue == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.signal_wifi_off, size: 48, color: AppColors.textSecondary),
                        const SizedBox(height: 12),
                        const Text('Could not load the live queue.'),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: () => _load(showSpinner: true), child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : mine == null
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'No upcoming serials.\nBook a serial from Specialists to track it live here.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () => _load(showSpinner: false),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // My serial hero
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.primary, AppColors.primaryDark],
                              ),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  isMyTurn
                                      ? '🎉 Your turn — please enter!'
                                      : ahead > 0
                                          ? '$ahead ahead · ~${ahead * avg} min wait'
                                          : 'Serial confirmed',
                                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '#$mySerial',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 56,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  '${mine.doctorName} · ${mine.specialization}',
                                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                                  textAlign: TextAlign.center,
                                ),
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
                                        running != null ? 'Running: #$running' : 'Queue not started yet',
                                        style: const TextStyle(fontWeight: FontWeight.bold),
                                      ),
                                      QueueStatusBadge(
                                        status: (queue?.isPaused ?? false)
                                            ? 'paused'
                                            : running != null
                                                ? 'in_queue'
                                                : 'confirmed',
                                      ),
                                    ],
                                  ),
                                  const Divider(height: 24),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('Waiting: ${queue?.waitingCount ?? 0}'),
                                      Text(
                                        'Done: ${queue?.completedCount ?? 0}',
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
                            "Today's queue (${queue?.totalAppointments ?? 0})",
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          const SizedBox(height: 8),
                          ...(queue?.entries ?? []).map((e) {
                            final isMine = e.id == mine.id;
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
                                  child: Text('#${e.serial}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                                title: Text(
                                  isMine ? 'You (Your Serial)' : e.patientName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                subtitle: Text(
                                  '${_fmtTime(e.startTime)} · ${e.visitType == 'followup' ? 'Follow-up' : 'New patient'}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: QueueStatusBadge(
                                  status: isRunning
                                      ? 'in_queue'
                                      : e.status == 'completed'
                                          ? 'completed'
                                          : 'confirmed',
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
    );
  }

  String _fmtTime(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    return DateFormat('hh:mm a').format(dt);
  }
}
