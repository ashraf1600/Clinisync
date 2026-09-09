import 'package:flutter/material.dart';
import 'core/constants/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/doctors/screens/doctor_directory_screen.dart';
import 'features/appointments/screens/patient_bookings_screen.dart';
import 'features/appointments/screens/live_queue_tracker_screen.dart';
import 'features/notifications/screens/notification_center_screen.dart';

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

  final List<Widget> _screens = const [
    DoctorDirectoryScreen(),
    PatientBookingsScreen(),
    LiveQueueTrackerScreen(),
    NotificationCenterScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.medical_services_outlined),
            selectedIcon: Icon(Icons.medical_services, color: AppColors.primary),
            label: 'Specialists',
          ),
          NavigationDestination(
            icon: Icon(Icons.confirmation_number_outlined),
            selectedIcon: Icon(Icons.confirmation_number, color: AppColors.primary),
            label: 'My Tokens',
          ),
          NavigationDestination(
            icon: Icon(Icons.access_time_outlined),
            selectedIcon: Icon(Icons.access_time_filled, color: AppColors.primary),
            label: 'Live Queue',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications, color: AppColors.primary),
            label: 'Alerts',
          ),
        ],
      ),
    );
  }
}
