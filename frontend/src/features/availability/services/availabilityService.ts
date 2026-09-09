import { apiClient } from '../../../services/api';
import { DoctorAvailabilityResponse, ChamberShift, AddSlotTimePayload, DoctorMultiDayScheduleResponse } from '../types';

export const availabilityService = {
  getDoctorSchedule: async (doctorId: string, days = 14, fromDate?: string, locationId?: string): Promise<DoctorMultiDayScheduleResponse> => {
    const params: any = { days };
    if (fromDate) params.fromDate = fromDate;
    if (locationId) params.locationId = locationId;
    const res = await apiClient.get(`/availability/${doctorId}/schedule`, { params });
    return res.data;
  },
  getSlots: async (doctorId: string, date: string, locationId?: string): Promise<DoctorAvailabilityResponse> => {
    const params: any = { date };
    if (locationId) params.locationId = locationId;
    const res = await apiClient.get(`/availability/${doctorId}`, { params });
    return res.data;
  },
  getShifts: async (doctorId: string, locationId?: string): Promise<ChamberShift[]> => {
    const params: any = {};
    if (locationId) params.locationId = locationId;
    const res = await apiClient.get(`/availability/${doctorId}/shifts`, { params });
    return res.data;
  },
  addShifts: async (doctorId: string, payload: AddSlotTimePayload): Promise<ChamberShift[]> => {
    const res = await apiClient.post(`/availability/${doctorId}/shifts`, payload);
    return res.data;
  },
  deleteShift: async (doctorId: string, shiftId: string): Promise<void> => {
    await apiClient.delete(`/availability/${doctorId}/shifts/${shiftId}`);
  },
  bulkGenerate: async (doctorId: string, data: any) => {
    const res = await apiClient.post(`/availability/${doctorId}/bulk-generate`, data);
    return res.data;
  },
  addException: async (doctorId: string, data: { exceptionDate: string; isAvailable: boolean; reason?: string }) => {
    const res = await apiClient.post(`/availability/${doctorId}/exceptions`, data);
    return res.data;
  },
};

