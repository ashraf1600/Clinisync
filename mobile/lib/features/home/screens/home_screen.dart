import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/widgets/lang_widgets.dart';

/// Bangla-first landing mirroring the website hero + features + steps.
class HomeScreen extends StatelessWidget {
  final void Function(int tab) onGo;
  const HomeScreen({super.key, required this.onGo});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 340,
            pinned: true,
            backgroundColor: AppColors.navyDark,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF0B3B39), Color(0xFF0F172A), Color(0xFF1E1B4B)],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 56, 20, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                          child: const T('ডিজিটাল ক্লিনিক সিরিয়াল', 'Digital clinic serials',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.tealAccent)),
                        ),
                        const SizedBox(height: 10),
                        const T('ডাক্তারের সিরিয়াল', 'Doctor serials',
                            style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Colors.white, height: 1.1)),
                        const T('এখন হাতের মুঠোয়', 'now in your pocket',
                            style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Color(0xFF2DD4BF), height: 1.1)),
                        const SizedBox(height: 8),
                        const T('লাইনে দাঁড়ানো নয় — বুক করুন, লাইভ দেখুন, সময়মতো যান।',
                            'No queues — book, track live, arrive on time.',
                            style: TextStyle(fontSize: 12, color: Colors.white70)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                icon: const Icon(Icons.confirmation_number, size: 16),
                                label: const T('সিরিয়াল নিন', 'Book serial'),
                                onPressed: () => onGo(1),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.monitor_heart, size: 16),
                                label: const T('লাইভ কিউ', 'Live queue'),
                                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white38)),
                                onPressed: () => onGo(3),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: const [
                      _Stat('৫০+', 'ডাক্তার', '50+', 'Doctors'),
                      _Stat('১০হাজার+', 'সিরিয়াল', '10k+', 'Serials'),
                      _Stat('০', 'ডাবল-বুকিং', '0', 'Double-book'),
                      _Stat('৳০', 'অগ্রিম', '৳0', 'Advance'),
                    ],
                  ),
                  const SizedBox(height: 18),
                  const T('কেন CliniSync?', 'Why CliniSync?',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  const _Feature(Icons.monitor_heart, 'লাইভ সিরিয়াল ট্র্যাকার', 'চলমান সিরিয়াল ও অপেক্ষা রিয়েল-টাইমে',
                      'Live serial tracker', 'Running serial & wait, real-time'),
                  const _Feature(Icons.qr_code_2, 'QR চেম্বার পাস', 'রিসেপশনে স্ক্যান করেই প্রবেশ',
                      'QR chamber pass', 'Scan at reception & enter'),
                  const _Feature(Icons.payments_outlined, 'অগ্রিম ছাড়াই', 'টাকা দেবেন চেম্বারে গিয়ে',
                      'Zero advance', 'Pay at the chamber'),
                  const _Feature(Icons.verified_outlined, 'জিরো ডাবল-বুকিং', 'এক স্লটে একজনই',
                      'Zero double-booking', 'One patient per slot'),
                  const SizedBox(height: 18),
                  const T('মাত্র ৩ ধাপে সিরিয়াল', 'Serial in 3 steps',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  const _Step('১', '1', Icons.search, 'ডাক্তার খুঁজুন', 'বিভাগ/নাম/হাসপাতাল দিয়ে',
                      'Find a doctor', 'By specialty / name / hospital'),
                  const _Step('২', '2', Icons.calendar_month, 'সিরিয়াল বুক করুন', 'দিন-সময় বেছে ১ ক্লিকে',
                      'Book your serial', 'Pick day & time in 1 tap'),
                  const _Step('৩', '3', Icons.notifications_active, 'লাইভ ট্র্যাক করুন', 'সঠিক সময়ে চেম্বারে যান',
                      'Track it live', 'Arrive right on time'),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => onGo(1),
                      style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                      child: const T('আজই সিরিয়াল নিন', 'Get your serial today'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Center(
                    child: T('CliniSync · রোগীর তথ্য সুরক্ষিত', 'CliniSync · Patient data protected',
                        style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String vBn, lBn, vEn, lEn;
  const _Stat(this.vBn, this.lBn, this.vEn, this.lEn);
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      T(vBn, vEn, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: AppColors.primary)),
      T(lBn, lEn, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
    ]);
  }
}

class _Feature extends StatelessWidget {
  final IconData icon;
  final String tBn, dBn, tEn, dEn;
  const _Feature(this.icon, this.tBn, this.dBn, this.tEn, this.dEn);
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: AppColors.primary, size: 22),
        ),
        title: T(tBn, tEn, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: T(dBn, dEn, style: const TextStyle(fontSize: 11)),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final String nBn, nEn;
  final IconData icon;
  final String tBn, dBn, tEn, dEn;
  const _Step(this.nBn, this.nEn, this.icon, this.tBn, this.dBn, this.tEn, this.dEn);
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Stack(
          alignment: Alignment.center,
          children: [
            Icon(icon, color: AppColors.primary, size: 30),
            Positioned(
              right: 0,
              top: 0,
              child: CircleAvatar(
                radius: 9,
                backgroundColor: AppColors.primary,
                child: T(nBn, nEn, style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
        title: T(tBn, tEn, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: T(dBn, dEn, style: const TextStyle(fontSize: 11)),
      ),
    );
  }
}
