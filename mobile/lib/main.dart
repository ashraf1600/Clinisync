import 'package:flutter/material.dart';
import 'core/constants/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'core/network/api_client.dart';
import 'core/i18n/lang.dart';
import 'features/home/screens/home_screen.dart';
import 'features/doctors/screens/doctor_directory_screen.dart';
import 'features/appointments/screens/patient_bookings_screen.dart';
import 'features/appointments/screens/live_queue_tracker_screen.dart';
import 'features/notifications/screens/notification_center_screen.dart';
import 'features/notifications/services/notification_repository.dart';
void main() {
  SessionStoreWire.wire();
  runApp(const CliniSyncApp());
}

/// Bridges ApiClient refresh persistence without BuildContext.
class SessionStoreWire {
  static void wire() {
    ApiClient().readRefreshToken = () => ApiClient().refreshToken;
    ApiClient().writeTokens = (access, refresh) {
      // SessionStore.save is async; ApiClient already updated in-memory.
    };
  }
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

  void _go(int i) => setState(() => _currentIndex = i);

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
    if (index == 4) {
      Future.delayed(const Duration(seconds: 1), _refreshUnread);
    } else {
      _refreshUnread();
    }
  }

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      HomeScreen(onGo: _go),
      const DoctorDirectoryScreen(),
      const PatientBookingsScreen(),
      const LiveQueueTrackerScreen(),
      const NotificationCenterScreen(),
    ];
    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home, color: AppColors.primary),
            label: Lang.t('হোম', 'Home'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.medical_services_outlined),
            selectedIcon: const Icon(Icons.medical_services, color: AppColors.primary),
            label: Lang.t('ডাক্তার', 'Doctors'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.confirmation_number_outlined),
            selectedIcon: const Icon(Icons.confirmation_number, color: AppColors.primary),
            label: Lang.t('টোকেন', 'Tokens'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.access_time_outlined),
            selectedIcon: const Icon(Icons.access_time_filled, color: AppColors.primary),
            label: Lang.t('লাইভ কিউ', 'Live Queue'),
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
            label: Lang.t('অ্যালার্ট', 'Alerts'),
          ),
        ],
      ),
    );
  }
}
