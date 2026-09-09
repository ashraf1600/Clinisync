export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  locationId?: string;
  doctorName: string;
  specialization: string;
  tokenNumber: number;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pay_at_chamber' | 'paid' | 'waived';
  fee: number;
  chiefComplaint?: string;
  createdAt: string;
}

export interface BookAppointmentPayload {
  doctorId: string;
  locationId?: string;
  startTime: string;
  endTime: string;
  visitType?: string;
  chiefComplaint?: string;
}

export interface DoctorQueueItem {
  id: string;
  serial?: number;
  patientId: string;
  patientName: string;
  phone?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  visitType: string;
  chiefComplaint?: string;
  vitals?: string;
  startTime: string;
  endTime: string;
  status: string;
  tokenNumber?: number;
  fee?: number;
  doctorId?: string;
}

export interface DoctorQueueResponse {
  date: string;
  doctorId?: string;
  doctorName?: string;
  specialization?: string;
  facilityName?: string;
  chamberRoom?: string;
  consultationFee?: number;
  totalAppointments: number;
  currentRunningSerial?: number | null;
  currentRunningPatientName?: string | null;
  waitingCount: number;
  completedCount: number;
  chamberStatus: string;
  isPaused: boolean;
  pauseMessage?: string | null;
  queue: DoctorQueueItem[];
  items: DoctorQueueItem[];
}
