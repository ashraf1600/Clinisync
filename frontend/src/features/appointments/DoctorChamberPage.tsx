import React, { useState, useEffect } from 'react';
import { Coffee, Play, Check, XCircle, Users, Activity, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { appointmentService } from './services/appointmentService';
import { doctorService } from '../doctors/services/doctorService';
import { DoctorQueueItem } from './types';
import { Doctor } from '../doctors/types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getDoctorChambers } from '../doctors/utils/chamberUtils';

export const DoctorChamberPage: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedChamberIndex, setSelectedChamberIndex] = useState<number>(0);
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [chamberStatus, setChamberStatus] = useState<string>('ACTIVE');
  const [currentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  
  // 5-minute break countdown timer (300 seconds)
  const [breakSeconds, setBreakSeconds] = useState<number>(300);

  useEffect(() => {
    doctorService.getDoctors({ pageSize: 50 })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
        setDoctors(items);
        if (items.length > 0) {
          const selfDoc = items.find((d) => d.userId === user?.id);
          setSelectedDoctorId(selfDoc ? selfDoc.id : items[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch doctors for chamber:', err);
      });
  }, [user]);

  const loadQueue = async (docId: string) => {
    if (!docId) return;
    try {
      setLoading(true);
      const res = await appointmentService.getDoctorQueue(docId, currentDate);
      setQueue(res.queue || res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctorId) {
      loadQueue(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  // Countdown timer effect during break
  useEffect(() => {
    let timer: any = null;
    if (isPaused && breakSeconds > 0) {
      timer = setInterval(() => {
        setBreakSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPaused, breakSeconds]);

  const handlePause = async () => {
    if (!selectedDoctorId) return;
    try {
      const res = await appointmentService.pauseQueue(selectedDoctorId, 5, 'Clinical Rest Break');
      setIsPaused(true);
      setBreakSeconds(300);
      setChamberStatus(res.chamberStatus || 'EMPTY (BREAK)');
      loadQueue(selectedDoctorId);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to pause queue');
    }
  };

  const handleResume = async () => {
    if (!selectedDoctorId) return;
    try {
      const res = await appointmentService.resumeQueue(selectedDoctorId);
      setIsPaused(false);
      setChamberStatus('ACTIVE');
      setBreakSeconds(300);
      loadQueue(selectedDoctorId);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to resume queue');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await appointmentService.updateStatus(id, 'completed');
      loadQueue(selectedDoctorId);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to complete visit');
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-6">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Clinical Console · Section 4.2 & 5
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-1">{t('chamber.title', 'Doctor Chamber & Live Queue')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('chamber.subtitle', 'Real-time patient intake, 5-minute break invariant, and visit status management.')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            disabled={user?.role === 'doctor' && !!doctors.find((d) => d.userId === user.id)}
            className="p-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.specialization})
              </option>
            ))}
          </select>

          {isPaused ? (
            <button
              onClick={handleResume}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{t('chamber.resume_btn', 'Resume Queue & Call In')}</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md cursor-pointer"
            >
              <Coffee className="w-4 h-4" />
              <span>{t('chamber.break_btn', 'Take 5-Min Break')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Chamber Status & Countdown Banner */}
      <div
        className={`p-5 rounded-2xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
          isPaused
            ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-400/40'
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isPaused ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black tracking-wide">
                {t('chamber.status_label', 'CHAMBER STATUS')}: {isPaused ? t('chamber.status_break', 'EMPTY (BREAK)') : t('chamber.status_active', 'ACTIVE')}
              </span>
              {isPaused && (
                <span className="bg-amber-200/80 text-amber-950 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                  ⏱️ {formatTimer(breakSeconds)} {t('chamber.remaining', 'remaining')}
                </span>
              )}
            </div>
            <p className="text-xs font-medium mt-0.5">
              {isPaused
                ? t('chamber.break_invariant', 'Strict Invariant: Chamber is EMPTY (BREAK). All waiting patients alerted. No patient in queue is called until resumed.')
                : (language === 'bn' ? 'চেম্বার সক্রিয় আছে। রোগীরা ক্রমানুসারে ভিজিটে প্রবেশ করছেন।' : 'Chamber is ACTIVE. Patients are called into consultation sequentially.')}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="text-[10px] text-slate-500 block font-semibold uppercase">
            {language === 'bn' ? 'চিকিৎসক' : 'Treating Clinician'}
          </span>
          <span className="text-xs font-bold text-slate-800">
            {currentDoctor?.name || 'Doctor'} · {currentDoctor?.chamber}
          </span>
        </div>
      </div>

      {/* Today's Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
          <div className="flex items-center space-x-2">
            <span>{t('chamber.today_queue', "Today's Patient Queue")} ({queue.length})</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {queue.filter((q) => q.status === 'completed').length} {t('chamber.completed_count', 'Completed')}
            </span>
          </div>
          <button
            onClick={() => loadQueue(selectedDoctorId)}
            className="text-blue-700 hover:text-blue-800 font-semibold text-xs cursor-pointer"
          >
            {language === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh Queue'}
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">Loading...</div>
        ) : queue.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">
              {language === 'bn' ? 'আজকের জন্য এই চেম্বারে কোনো সিরিয়াল বাকি নেই' : 'No appointments scheduled today for this chamber'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t('chamber.col_serial', 'Serial #')}</th>
                  <th className="py-3 px-4">{t('chamber.col_patient', 'Patient Name')}</th>
                  <th className="py-3 px-4">Patient Details</th>
                  <th className="py-3 px-4">{t('chamber.col_type', 'Visit Type')}</th>
                  <th className="py-3 px-4">{t('chamber.col_complaint', 'Chief Complaint')}</th>
                  <th className="py-3 px-4">{t('chamber.col_slot', 'Scheduled Slot')}</th>
                  <th className="py-3 px-4">{t('chamber.col_status', 'Status')}</th>
                  <th className="py-3 px-4 text-right">{t('chamber.col_action', 'Chamber Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-black text-sm text-blue-700 font-mono bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                        #{(item.serial || 0) < 10 ? `0${item.serial || 0}` : item.serial}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.patientName}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-semibold">{item.age ? `${item.age} years` : 'Age not provided'}{item.gender ? ` · ${item.gender}` : ''}</div>
                      <div className="text-[11px] text-red-700 font-bold">Blood group: {item.bloodGroup || 'Not provided'}</div>
                      {item.phone && <div className="text-[11px]">{item.phone}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">{item.visitType.replace('_', ' ')}</td>
                    <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                      <span className="font-medium text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {item.chiefComplaint}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'in_queue'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.status !== 'completed' ? (
                        <button
                          onClick={() => handleComplete(item.id)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm transition inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('chamber.action_complete', 'Complete Visit')}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-bold inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t('chamber.action_done', 'Consultation Done')}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
