import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/i18n/lang.dart';
import '../../../../core/widgets/lang_widgets.dart';
import '../models/doctor_model.dart';
import '../services/doctor_repository.dart';
import '../../auth/screens/login_screen.dart';
import '../../auth/screens/profile_screen.dart';
import 'booking_modal_screen.dart';

class DoctorDirectoryScreen extends StatefulWidget {
  const DoctorDirectoryScreen({super.key});

  @override
  State<DoctorDirectoryScreen> createState() => _DoctorDirectoryScreenState();
}

class _DoctorDirectoryScreenState extends State<DoctorDirectoryScreen> {
  final DoctorRepository _repo = DoctorRepository();
  final _search = TextEditingController();
  List<DoctorModel> _doctors = [];
  bool _isLoading = true;
  String? _error;
  String _selectedSpec = 'All';

  final List<String> _specialties = ['All', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine', 'Gynecology', 'Dermatology'];

  @override
  void initState() {
    super.initState();
    _loadDoctors();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadDoctors() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final docs = await _repo.getDoctors(
        specialization: _selectedSpec == 'All' ? null : _selectedSpec,
        search: _search.text.trim().isEmpty ? null : _search.text.trim(),
      );
      if (!mounted) return;
      setState(() => _doctors = docs);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = Lang.t('লোড করা যায়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।', 'Could not load. Check internet and retry.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(Lang.t('CliniSync বিশেষজ্ঞ', 'CliniSync Specialists'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: const [
          Padding(padding: EdgeInsets.only(right: 4), child: LangToggle()),
          SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _loadDoctors(),
              decoration: InputDecoration(
                hintText: Lang.t('নাম / বিভাগ / হাসপাতাল লিখুন…', 'Name / specialty / hospital…'),
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: IconButton(icon: const Icon(Icons.person, size: 20), tooltip: 'Profile', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()))),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ),
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
                              ElevatedButton(onPressed: _loadDoctors, child: Text(Lang.t('আবার চেষ্টা', 'Retry'))),
                            ],
                          ),
                        ),
                      )
                    : _doctors.isEmpty
                        ? Center(child: Text(Lang.t('কোনো ডাক্তার পাওয়া যায়নি।', 'No specialists found.')))
                        : RefreshIndicator(
                            onRefresh: _loadDoctors,
                            child: ListView.builder(
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
                                                  ? Text(doc.name.isNotEmpty ? doc.name[0] : 'D',
                                                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 22))
                                                  : null,
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Row(
                                                    children: [
                                                      Expanded(child: Text(doc.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                        decoration: BoxDecoration(
                                                            color: AppColors.primary.withOpacity(0.1),
                                                            borderRadius: BorderRadius.circular(10)),
                                                        child: Text(doc.bmdcNumber,
                                                            style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: AppColors.primary)),
                                                      ),
                                                    ],
                                                  ),
                                                  Text('${doc.specialization} · ${doc.degrees}',
                                                      style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                                                  Text('${doc.facility} · ${doc.chamber}',
                                                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                                                  const SizedBox(height: 4),
                                                  Row(
                                                    children: [
                                                      const Icon(Icons.star, color: AppColors.amber, size: 14),
                                                      const SizedBox(width: 4),
                                                      Text('${doc.rating}',
                                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                                      Text(Lang.t(' · ${doc.experienceYears} বছরের অভিজ্ঞতা',
                                                          ' · ${doc.experienceYears} yrs exp'),
                                                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (doc.bio != null && doc.bio!.isNotEmpty) ...[
                                          const SizedBox(height: 8),
                                          Text(doc.bio!,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                        ],
                                        const SizedBox(height: 12),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text('৳${doc.consultationFee.toInt()}',
                                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
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
                                              child: Text(Lang.t('সিরিয়াল নিন', 'Book Serial')),
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
