import { apiClient } from '../../../services/api';
import { Appointment, BookAppointmentPayload, DoctorQueueResponse } from '../types';

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
  getDoctorQueue: async (doctorId: string, date: string): Promise<DoctorQueueResponse> => {
    const res = await apiClient.get(`/appointments/doctor/${doctorId}`, { params: { date } });
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
  updateStatus: async (id: string, status: string) => {
    const res = await apiClient.put(`/appointments/${id}/status`, { status });
    return res.data;
  },
};
