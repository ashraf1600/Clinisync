import { apiClient } from '../../../services/api';
import { Doctor, DoctorListResponse, DoctorCreatePayload } from '../types';

export const doctorService = {
  getDoctors: async (params?: { specialization?: string; search?: string; page?: number; pageSize?: number }): Promise<DoctorListResponse> => {
    const res = await apiClient.get('/doctors', { params });
    return res.data;
  },
  onboardDoctor: async (payload: DoctorCreatePayload): Promise<Doctor> => {
    const res = await apiClient.post('/doctors', payload);
    return res.data;
  },
  getMyProfile: async (): Promise<Doctor> => {
    const res = await apiClient.get('/doctors/me');
    return res.data;
  },
  updateMyProfile: async (payload: Omit<Partial<Doctor>, 'locations'> & { locations?: unknown[] }): Promise<Doctor> => {
    const res = await apiClient.put('/doctors/me', payload);
    return res.data;
  },
  uploadMyPhoto: async (file: File): Promise<Doctor> => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await apiClient.post('/doctors/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getDoctorLocations: async (doctorId: string): Promise<any[]> => {
    const res = await apiClient.get(`/doctors/${doctorId}/locations`);
    return res.data;
  },
  createDoctorLocation: async (doctorId: string, payload: any): Promise<any> => {
    const res = await apiClient.post(`/doctors/${doctorId}/locations`, payload);
    return res.data;
  },
  updateDoctorLocation: async (doctorId: string, locationId: string, payload: any): Promise<any> => {
    const res = await apiClient.put(`/doctors/${doctorId}/locations/${locationId}`, payload);
    return res.data;
  },
  deleteDoctorLocation: async (doctorId: string, locationId: string): Promise<void> => {
    await apiClient.delete(`/doctors/${doctorId}/locations/${locationId}`);
  },
};
