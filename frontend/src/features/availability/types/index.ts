export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isPast?: boolean;
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

export interface DayScheduleSummary {
  date: string;
  dayOfWeek: number;
  dayName: string;
  dayNameBn: string;
  formattedDate: string;
  isToday: boolean;
  hasShift: boolean;
  chamberTiming?: string;
  totalSlots: number;
  availableSlotsCount: number;
  isFull: boolean;
  slots: TimeSlot[];
}

export interface DoctorMultiDayScheduleResponse {
  doctorId: string;
  locationId?: string;
  facilityName?: string;
  chamberRoom?: string;
  consultationFee: number;
  sittingDays: string[];
  sittingDaysBn: string[];
  sittingHours: string;
  nextAvailableDate?: string;
  nextAvailableSlot?: TimeSlot;
  days: DayScheduleSummary[];
}


