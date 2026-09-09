import 'package:flutter/material.dart';
import 'core/constants/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/doctors/screens/doctor_directory_screen.dart';
import 'features/appointments/screens/patient_bookings_screen.dart';
import 'features/appointments/screens/live_queue_tracker_screen.dart';
import 'features/notifications/screens/notification_center_screen.dart';
import 'features/notifications/services/notification_repository.dart';

void main() {
  runApp(const CliniSyncApp());
}

class CliniSyncApp extends StatelessWidget {
  const CliniSyncApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CliniSync',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  int _unreadCount = 0;
  final NotificationRepository _notifRepo = NotificationRepository();

  final List<Widget> _screens = const [
    DoctorDirectoryScreen(),
    PatientBookingsScreen(),
    LiveQueueTrackerScreen(),
    NotificationCenterScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _refreshUnread();
  }

  Future<void> _refreshUnread() async {
    try {
      final count = await _notifRepo.getUnreadCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {
      // Not logged in yet or offline: keep badge hidden.
    }
  }

  void _onDestinationSelected(int index) {
    setState(() => _currentIndex = index);
    if (index == 3) {
      // Opening Alerts: re-sync badge shortly after (screen marks items read on tap).
      Future.delayed(const Duration(seconds: 1), _refreshUnread);
    } else {
      _refreshUnread();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.medical_services_outlined),
            selectedIcon: Icon(Icons.medical_services, color: AppColors.primary),
            label: 'Specialists',
          ),
          const NavigationDestination(
            icon: Icon(Icons.confirmation_number_outlined),
            selectedIcon: Icon(Icons.confirmation_number, color: AppColors.primary),
            label: 'My Tokens',
          ),
          const NavigationDestination(
            icon: Icon(Icons.access_time_outlined),
            selectedIcon: Icon(Icons.access_time_filled, color: AppColors.primary),
            label: 'Live Queue',
          ),
          NavigationDestination(
            icon: Badge.count(
              count: _unreadCount,
              isLabelVisible: _unreadCount > 0,
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge.count(
              count: _unreadCount,
              isLabelVisible: _unreadCount > 0,
              child: const Icon(Icons.notifications, color: AppColors.primary),
            ),
            label: 'Alerts',
          ),
        ],
      ),
    );
  }
}
