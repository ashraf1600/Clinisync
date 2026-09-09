import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../models/doctor_model.dart';
import '../../availability/models/time_slot_model.dart';
import '../../availability/services/availability_repository.dart';
import '../../appointments/services/appointment_repository.dart';

class BookingModalScreen extends StatefulWidget {
  final DoctorModel doctor;
  const BookingModalScreen({super.key, required this.doctor});

  @override
  State<BookingModalScreen> createState() => _BookingModalScreenState();
}

class _BookingModalScreenState extends State<BookingModalScreen> {
  final AvailabilityRepository _availRepo = AvailabilityRepository();
  final AppointmentRepository _apptRepo = AppointmentRepository();

  List<TimeSlotModel> _slots = [];
  TimeSlotModel? _selectedSlot;
  bool _loadingSlots = true;
  bool _isBooking = false;
  String? _error;

  final String _selectedDate = DateTime.now().add(const Duration(days: 1)).toIso8601String().split('T')[0];

  @override
  void initState() {
    super.initState();
    _loadSlots();
  }

  Future<void> _loadSlots() async {
    setState(() => _loadingSlots = true);
    try {
      final slots = await _availRepo.getSlots(widget.doctor.id, _selectedDate);
      setState(() => _slots = slots);
    } catch (e) {
      setState(() => _error = 'Could not load slots');
    } finally {
      setState(() => _loadingSlots = false);
    }
  }

  Future<void> _book() async {
    if (_selectedSlot == null) return;
    setState(() {
      _isBooking = true;
      _error = null;
    });
    try {
      final appt = await _apptRepo.bookAppointment(
        doctorId: widget.doctor.id,
        startTime: _selectedSlot!.startTime,
        endTime: _selectedSlot!.endTime,
        chiefComplaint: 'General consultation',
      );
      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Token Reserved! 🎫'),
            content: Text('Serial #${appt.tokenNumber} assigned with ${appt.doctorName}. Pay at chamber upon arrival.'),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pop(context);
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      setState(() => _error = 'Slot conflict or booking error. Please select another slot.');
      _loadSlots();
    } finally {
      setState(() => _isBooking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Book with ${widget.doctor.name}')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Select Slot for $_selectedDate', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 12),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
              ),
            Expanded(
              child: _loadingSlots
                  ? const Center(child: CircularProgressIndicator())
                  : _slots.isEmpty
                      ? const Center(child: Text('No slots scheduled for this date.'))
                      : GridView.builder(
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            childAspectRatio: 2.2,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                          ),
                          itemCount: _slots.length,
                          itemBuilder: (context, i) {
                            final slot = _slots[i];
                            final isSelected = _selectedSlot == slot;
                            final timeText = slot.startTime.length >= 16 ? slot.startTime.substring(11, 16) : slot.startTime;
                            return ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: !slot.isAvailable
                                    ? Colors.grey.shade200
                                    : isSelected
                                        ? AppColors.primary
                                        : Colors.blue.shade50,
                                foregroundColor: isSelected ? Colors.white : AppColors.textPrimary,
                              ),
                              onPressed: slot.isAvailable ? () => setState(() => _selectedSlot = slot) : null,
                              child: Text(timeText, style: const TextStyle(fontSize: 12)),
                            );
                          },
                        ),
            ),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _selectedSlot == null || _isBooking ? null : _book,
                child: _isBooking ? const CircularProgressIndicator(color: Colors.white) : const Text('Confirm Reservation'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
