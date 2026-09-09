import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class QueueStatusBadge extends StatelessWidget {
  final String status;

  const QueueStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;
    String label;

    switch (status.toLowerCase()) {
      case 'confirmed':
        bg = AppColors.success.withOpacity(0.12);
        text = AppColors.success;
        label = 'CONFIRMED';
        break;
      case 'in_queue':
        bg = AppColors.primary.withOpacity(0.12);
        text = AppColors.primary;
        label = 'IN CHAMBER';
        break;
      case 'break':
      case 'paused':
        bg = AppColors.amber.withOpacity(0.15);
        text = AppColors.amber;
        label = 'EMPTY (BREAK)';
        break;
      case 'completed':
        bg = Colors.slate.shade100;
        text = AppColors.textSecondary;
        label = 'COMPLETED';
        break;
      case 'cancelled':
        bg = AppColors.error.withOpacity(0.12);
        text = AppColors.error;
        label = 'CANCELLED';
        break;
      default:
        bg = Colors.grey.shade100;
        text = AppColors.textPrimary;
        label = status.toUpperCase();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: text,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
