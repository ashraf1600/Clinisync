export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  locationId?: string;
  facilityName?: string;
  chamberRoom?: string;
}

export interface DoctorAvailabilityResponse {
  doctorId: string;
  date: string;
  locationId?: string;
  facilityName?: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  slots: TimeSlot[];
}

export interface ChamberShift {
  id: string;
  doctorId: string;
  locationId?: string;
  facilityName?: string;
  chamberRoom?: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
}

export interface AddSlotTimePayload {
  locationId?: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  bufferMinutes?: number;
  isActive?: boolean;
}

