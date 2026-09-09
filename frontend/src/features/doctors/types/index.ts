export interface DoctorChamberLocation {
  id: string;
  facilityName: string;
  branchArea: string;
  chamberRoom: string;
  scheduleDays: string;
  shiftHours: string;
  consultationFee: number;
  followupFee: number;
  contactPhone: string;
  address?: string;
  isActive?: boolean;
}

export interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  degrees: string;
  bmdcNumber: string;
  designation?: string;
  facility?: string;
  facilityName?: string;
  chamber?: string;
  chamberRoom?: string;
  chambers?: DoctorChamberLocation[];
  profilePhotoUrl?: string;
  bio?: string;
  consultationFee: number;
  followupFee: number;
  rating: number;
  experienceYears: number;
  locations?: DoctorChamberLocation[];
}

export interface DoctorListResponse {
  items: Doctor[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

export interface DoctorCreatePayload {
  userId: string;
  specialization: string;
  degrees: string;
  bmdcNumber: string;
  designation?: string;
  facilityName: string;
  chamberRoom: string;
  consultationFee: number;
  followupFee: number;
  bio?: string;
  locations?: Omit<DoctorChamberLocation, 'id' | 'consultationFee' | 'followupFee' | 'scheduleDays' | 'shiftHours'>[];
}
