import { Doctor, DoctorChamberLocation } from '../types';

export const getDoctorChambers = (doctor?: Doctor | null): DoctorChamberLocation[] => {
  if (!doctor) return [];
  const baseFacility = doctor.facility || doctor.facilityName || 'Popular Diagnostic Centre';
  const baseRoom = doctor.chamber || doctor.chamberRoom || 'Room #405, Level 4';
  const baseFee = doctor.consultationFee || 1200;
  const baseFollowup = doctor.followupFee || Math.round(baseFee * 0.6);

  if (doctor.locations && doctor.locations.length > 0) {
    return doctor.locations.map((loc, idx) => ({
      id: loc.id || `${doctor.id}-chamber-${idx}`,
      facilityName: loc.facilityName || baseFacility,
      branchArea: loc.branchArea || loc.facilityName || 'ঢাকা (Dhaka Branch)',
      chamberRoom: loc.chamberRoom || baseRoom,
      scheduleDays: loc.scheduleDays || 'শনি — বৃহস্পতি (Sat — Thu)',
      shiftHours: loc.shiftHours || 'বিকাল ০৫:০০ — ০৯:০০',
      consultationFee: loc.consultationFee ?? baseFee,
      followupFee: loc.followupFee ?? baseFollowup,
      contactPhone: loc.contactPhone || '+880 1711-987654',
      address: loc.address || '',
      isActive: loc.isActive ?? true,
    }));
  }

  if (doctor.chambers && doctor.chambers.length > 0) {
    return doctor.chambers.map((ch, idx) => ({
      ...ch,
      branchArea: ch.branchArea || ch.facilityName || 'ঢাকা (Dhaka Branch)',
      scheduleDays: ch.scheduleDays || 'শনি — বৃহস্পতি (Sat — Thu)',
      shiftHours: ch.shiftHours || 'বিকাল ০৫:০০ — ০৯:০০',
      consultationFee: ch.consultationFee ?? baseFee,
      followupFee: ch.followupFee ?? baseFollowup,
    }));
  }

  // Fallback to primary facility if no locations defined
  return [
    {
      id: '',
      facilityName: baseFacility,
      branchArea: 'Primary Branch',
      chamberRoom: baseRoom,
      scheduleDays: 'শনি — বৃহস্পতি (Sat — Thu)',
      shiftHours: 'বিকাল ০৫:০০ — ০৯:০০',
      consultationFee: baseFee,
      followupFee: baseFollowup,
      contactPhone: '+880 1711-000000',
      isActive: true,
    }
  ];
};
