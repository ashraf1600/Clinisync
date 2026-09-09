import { Doctor, DoctorChamberLocation } from '../types';

export const getApiBaseOrigin = (): string => {
  const base =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    '';
  if (typeof base === 'string' && /^https?:\/\//i.test(base)) {
    // Strip trailing /api/v1 or /api so we can resolve /uploads/... correctly
    return base.replace(/\/api\/v1\/?$/i, '').replace(/\/api\/?$/i, '').replace(/\/$/, '');
  }
  return '';
};

/** Resolve backend relative photo paths (e.g. "/uploads/profile_photos/x.jpg") to a loadable URL. */
export const getDoctorPhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    const origin = getApiBaseOrigin();
    // In dev, vite proxies /uploads -> backend; in prod same-origin serves /uploads.
    // If an absolute API origin is configured (e.g. CloudFront/API domain), prefix it.
    return origin ? `${origin}${trimmed}` : trimmed;
  }
  return trimmed;
};

export const getDoctorInitials = (name?: string | null): string => {
  if (!name) return 'DR';
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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
