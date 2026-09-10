import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../models/doctor_model.dart';
import '../services/doctor_repository.dart';
import '../../auth/screens/login_screen.dart';
import 'booking_modal_screen.dart';

class DoctorDirectoryScreen extends StatefulWidget {
  const DoctorDirectoryScreen({super.key});

  @override
  State<DoctorDirectoryScreen> createState() => _DoctorDirectoryScreenState();
}

class _DoctorDirectoryScreenState extends State<DoctorDirectoryScreen> {
  final DoctorRepository _repo = DoctorRepository();
  List<DoctorModel> _doctors = [];
  bool _isLoading = true;
  String? _error;
  String _selectedSpec = 'All';

  final List<String> _specialties = ['All', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine'];

  @override
  void initState() {
    super.initState();
    _loadDoctors();
  }

  Future<void> _loadDoctors() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final docs = await _repo.getDoctors(
        specialization: _selectedSpec == 'All' ? null : _selectedSpec,
      );
      setState(() => _doctors = docs);
    } catch (e) {
      setState(() => _error = 'Could not load specialists.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CliniSync Specialists', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.login),
            tooltip: 'Log in / Register',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips
          SizedBox(
            height: 50,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              scrollDirection: Axis.horizontal,
              itemCount: _specialties.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final spec = _specialties[i];
                final isSelected = _selectedSpec == spec;
                return ChoiceChip(
                  label: Text(spec),
                  selected: isSelected,
                  selectedColor: AppColors.primary,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 12,
                  ),
                  onSelected: (val) {
                    if (val) {
                      setState(() => _selectedSpec = spec);
                      _loadDoctors();
                    }
                  },
                );
              },
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : _doctors.isEmpty
                        ? const Center(child: Text('No specialists found.'))
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _doctors.length,
                            itemBuilder: (context, i) {
                              final doc = _doctors[i];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 16),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 28,
                                            backgroundColor: AppColors.primary.withOpacity(0.1),
                                            backgroundImage: doc.profilePhotoUrl != null
                                                ? NetworkImage(doc.profilePhotoUrl!)
                                                : null,
                                            child: doc.profilePhotoUrl == null
                                                ? const Icon(Icons.person, color: AppColors.primary, size: 28)
                                                : null,
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(doc.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                                Text('${doc.specialization} · ${doc.degrees}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                                                const SizedBox(height: 4),
                                                Row(
                                                  children: [
                                                    const Icon(Icons.star, color: AppColors.amber, size: 14),
                                                    const SizedBox(width: 4),
                                                    Text('${doc.rating}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                                    const SizedBox(width: 8),
                                                    Text('•  ${doc.experienceYears} yrs exp', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text('Fee: ৳${doc.consultationFee.toInt()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppColors.primary,
                                              foregroundColor: Colors.white,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                            onPressed: () {
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute(builder: (_) => BookingModalScreen(doctor: doc)),
                                              );
                                            },
                                            child: const Text('Book Serial'),
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
        ],
      ),
    );
  }
}
