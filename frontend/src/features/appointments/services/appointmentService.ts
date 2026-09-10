import { apiClient } from '../../../services/api';
import { Appointment, BookAppointmentPayload, DoctorQueueResponse } from '../types';

export interface VerifyPassResult {
  id: string;
  tokenNumber: number;
  status: string;
  valid: boolean;
  patientName: string;
  doctorName: string;
  specialization: string;
  facilityName?: string;
  chamberRoom?: string;
  startTime: string;
  endTime: string;
  paymentStatus: string;
  fee: number;
}

/** Deep link encoded in the chamber-pass QR, opened by reception scanners. */
export const getPassVerifyUrl = (appointmentId: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/#verify/${appointmentId}`;
}

export const appointmentService = {
  book: async (payload: BookAppointmentPayload): Promise<Appointment> => {
    const idempotencyKey = crypto.randomUUID();
    const res = await apiClient.post('/appointments/book', payload, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
    return res.data;
  },
  getMyAppointments: async (filter: 'upcoming' | 'past' = 'upcoming'): Promise<Appointment[]> => {
    const res = await apiClient.get('/appointments/patient/me', { params: { filter } });
    return res.data;
  },
  cancel: async (id: string, reason: string = 'User cancellation') => {
    const res = await apiClient.put(`/appointments/${id}/cancel`, { reason });
    return res.data;
  },
  reschedule: async (id: string, newStartTime: string, newEndTime: string) => {
    const idempotencyKey = crypto.randomUUID();
    const res = await apiClient.put(`/appointments/${id}/reschedule`, { newStartTime, newEndTime }, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
    return res.data;
  },
  verifyPass: async (id: string): Promise<VerifyPassResult> => {
    const res = await apiClient.get(`/appointments/${id}/verify`);
    return res.data;
  },
  getDoctorQueue: async (doctorId: string, date: string, locationId?: string): Promise<DoctorQueueResponse> => {
    const params: any = { date };
    if (locationId) params.locationId = locationId;
    const res = await apiClient.get(`/appointments/doctor/${doctorId}`, { params });
    return res.data;
  },
  pauseQueue: async (doctorId: string, pauseMinutes: number = 5, reason: string = 'Short break') => {
    const res = await apiClient.put(`/appointments/doctor/${doctorId}/queue-pause`, { pauseMinutes, reason });
    return res.data;
  },
  resumeQueue: async (doctorId: string) => {
    const res = await apiClient.put(`/appointments/doctor/${doctorId}/queue-resume`);
    return res.data;
  },
  updateStatus: async (id: string, status: string, doctorNotes?: string) => {
    const res = await apiClient.put(`/appointments/${id}/status`, { status, doctorNotes });
    return res.data;
  },
  updatePayment: async (id: string, paymentStatus: string) => {
    const res = await apiClient.put(`/appointments/${id}/payment`, { paymentStatus });
    return res.data;
  },
  createWalkIn: async (payload: { doctorId: string; locationId?: string; patientName: string; patientPhone?: string; startTime: string; endTime: string; visitType?: string; chiefComplaint?: string }) => {
    const res = await apiClient.post('/appointments/walk-in', payload);
    return res.data;
  },
};
