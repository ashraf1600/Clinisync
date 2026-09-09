import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/queue_status_badge.dart';

class LiveQueueTrackerScreen extends StatelessWidget {
  const LiveQueueTrackerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Live Chamber Queue')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.08),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary, width: 4),
                ),
                child: const Center(
                  child: Text(
                    '04',
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Your Serial Number', style: TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 12),
              const QueueStatusBadge(status: 'CONFIRMED'),
              const SizedBox(height: 24),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Doctor: Dr. Mahbubur Rahman', style: TextStyle(fontWeight: FontWeight.bold)),
                          Text('Chamber #301, Level 3', style: TextStyle(color: AppColors.textSecondary)),
                        ],
                      ),
                      Divider(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Currently Consulting: Serial #02'),
                          Text('Patients Ahead: 1', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
