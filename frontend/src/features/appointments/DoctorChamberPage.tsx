import React, { useState, useEffect, useRef } from 'react';
import { Coffee, Play, Check, XCircle, Users, Activity, Clock, ShieldAlert, CheckCircle2, Phone, PhoneCall, FileText, DollarSign, UserPlus, MapPin, AlertTriangle, X } from 'lucide-react';
import { appointmentService } from './services/appointmentService';
import { doctorService } from '../doctors/services/doctorService';
import { DoctorQueueItem } from './types';
import { Doctor } from '../doctors/types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getDoctorChambers } from '../doctors/utils/chamberUtils';
import { PageShell, PageHero } from '../../components/Page';

export const DoctorChamberPage: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedChamberIndex, setSelectedChamberIndex] = useState<number>(0);
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [chamberStatus, setChamberStatus] = useState<string>('ACTIVE');
  const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [currentDate] = useState<string>(() => toLocalDateStr(new Date()));
  const [loading, setLoading] = useState(false);
  // Doctor chamber filter (multi-chamber)
  const [chamberFilter, setChamberFilter] = useState<string>('');
  // Notes modal
  const [noteAppt, setNoteAppt] = useState<DoctorQueueItem | null>(null);
  const [noteText, setNoteText] = useState('');
  // Walk-in modal
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');
  const [walkComplaint, setWalkComplaint] = useState('');
  const [walkVisitType, setWalkVisitType] = useState('new_consultation');
  const [walkSaving, setWalkSaving] = useState(false);
  // Auto-resume beep
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const loadQueue = async (docId: string, locationId?: string) => {
    if (!docId) return;
    try {
      setLoading(true);
      const res = await appointmentService.getDoctorQueue(docId, currentDate, locationId);
      setQueue(res.queue || res.items || []);
      setIsPaused(!!res.isPaused);
      setChamberStatus(res.chamberStatus || (res.isPaused ? 'EMPTY (BREAK)' : 'ACTIVE'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctorId) {
      loadQueue(selectedDoctorId, chamberFilter || undefined);
    }
  }, [selectedDoctorId, chamberFilter, currentDate]);

  // Countdown timer effect during break + auto-resume beep at 0
  useEffect(() => {
    let timer: any = null;
    if (isPaused && breakSeconds > 0) {
      timer = setInterval(() => {
        setBreakSeconds((prev) => {
          if (prev <= 1) {
            // Beep on finish
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const o = ctx.createOscillator(); o.frequency.value = 880;
              o.connect(ctx.destination); o.start(); setTimeout(() => o.stop(), 400);
            } catch {}
            return 0;
          }
          return prev - 1;
        });
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
      loadQueue(selectedDoctorId, chamberFilter || undefined);
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
      loadQueue(selectedDoctorId, chamberFilter || undefined);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to resume queue');
    }
  };

  const handleComplete = async (id: string, notes?: string) => {
    try {
      await appointmentService.updateStatus(id, 'completed', notes);
      setNoteAppt(null); setNoteText('');
      loadQueue(selectedDoctorId, chamberFilter || undefined);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to complete visit');
    }
  };

  const handleNoShow = async (id: string) => {
    if (!confirm(language === 'bn' ? 'রোগী আসেনি হিসেবে চিহ্নিত করবেন?' : 'Mark as no-show?')) return;
    try {
      await appointmentService.updateStatus(id, 'no_show');
      loadQueue(selectedDoctorId, chamberFilter || undefined);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed');
    }
  };

  const handlePaid = async (id: string, paid: boolean) => {
    try {
      await appointmentService.updatePayment(id, paid ? 'paid' : 'pay_at_chamber');
      loadQueue(selectedDoctorId, chamberFilter || undefined);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to update payment');
    }
  };

  const handleWalkIn = async () => {
    if (!selectedDoctorId || !walkName.trim()) return;
    try {
      setWalkSaving(true);
      // Walk-in at next 15-min slot today
      const now = new Date();
      const start = new Date(now.getTime() + 5 * 60000);
      start.setSeconds(0, 0);
      const end = new Date(start.getTime() + 20 * 60000);
      const toUtc = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().replace('.000Z','Z');
      // Find location for fee/chamber
      const chambers = currentDoctor ? getDoctorChambers(currentDoctor) : [];
      const loc = chambers.find(c => c.id === chamberFilter) || chambers[0];
      await appointmentService.createWalkIn({
        doctorId: selectedDoctorId,
        locationId: loc?.id,
        patientName: walkName.trim(),
        patientPhone: walkPhone.trim() || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        visitType: walkVisitType,
        chiefComplaint: walkComplaint || 'Walk-in consultation',
      });
      setShowWalkIn(false); setWalkName(''); setWalkPhone(''); setWalkComplaint('');
      loadQueue(selectedDoctorId, chamberFilter || undefined);
    } catch (e: any) {
      alert(e.response?.data?.error?.message || e.message || 'Walk-in failed');
    } finally { setWalkSaving(false); }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <PageShell>
      <PageHero
        eyebrow={language === 'bn' ? 'ক্লিনিক্যাল কনসোল · লাইভ' : 'Clinical Console · Live'}
        title={<>{t('chamber.title', 'Doctor Chamber & Live Queue')}</>}
        subtitle={t('chamber.subtitle', 'Real-time patient intake, 5-minute break invariant, and visit status management.')}
      />
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-slate-700">{language === 'bn' ? 'কনসোল নিয়ন্ত্রণ' : 'Console Controls'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {/* Per-chamber filter */}
          {currentDoctor && getDoctorChambers(currentDoctor).length > 1 && (
            <select
              value={chamberFilter}
              onChange={(e) => setChamberFilter(e.target.value)}
              className="p-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white flex items-center gap-1"
            >
              <option value="">{language === 'bn' ? 'সব চেম্বার' : 'All Chambers'}</option>
              {getDoctorChambers(currentDoctor).map((c) => (
                <option key={c.id} value={c.id}>{c.facilityName} — {c.chamberRoom}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowWalkIn(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> {language === 'bn' ? 'ওয়াক-ইন যোগ' : 'Walk-in'}
          </button>
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
      {/* BMDC / Photo nudge */}
      {currentDoctor && (!currentDoctor.profilePhotoUrl || currentDoctor.bmdcNumber === 'BMDC-PENDING' || !currentDoctor.bmdcNumber) && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-bold text-blue-900">{language === 'bn' ? 'প্রোফাইল সম্পূর্ণ করুন' : 'Complete your profile'}</p>
            <p className="text-blue-700 mt-1">
              {!currentDoctor.profilePhotoUrl ? (language === 'bn' ? 'ছবি নেই — ' : 'No photo — ') : ''}
              {(currentDoctor.bmdcNumber === 'BMDC-PENDING' || !currentDoctor.bmdcNumber) ? (language === 'bn' ? 'BMDC নম্বর যাচাই বাকি। ' : 'BMDC pending. ') : ''}
              {language === 'bn' ? 'প্রোফাইল পেজ থেকে ছবি ও BMDC আপডেট করুন।' : 'Update photo & BMDC from profile page.'}
            </p>
          </div>
        </div>
      )}

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

      {/* Day overview cards */}
      {(() => {
        const completed = queue.filter(q => q.status === 'completed').length;
        const waiting = queue.filter(q => q.status === 'confirmed' || q.status === 'pending').length;
        const noShow = queue.filter(q => q.status === 'no_show').length;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">{language === 'bn' ? 'আজ মোট' : 'Total Today'}</p>
              <p className="text-2xl font-black text-slate-900">{queue.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-700">{language === 'bn' ? 'সম্পন্ন' : 'Completed'}</p>
              <p className="text-2xl font-black text-emerald-800">{completed}</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-center">
              <p className="text-[10px] font-bold uppercase text-amber-700">{language === 'bn' ? 'অপেক্ষমাণ' : 'Waiting'}</p>
              <p className="text-2xl font-black text-amber-800">{waiting}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-500">{language === 'bn' ? 'অনুপস্থিত' : 'No-show'}</p>
              <p className="text-2xl font-black text-slate-700">{noShow}</p>
            </div>
          </div>
        );
      })()}

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
            <table className="w-full text-left text-xs table-premium">
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
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {item.phone && (
                          <a href={`tel:${item.phone}`} className="p-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200" title={language === 'bn' ? 'কল করুন' : 'Call'}>
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handlePaid(item.id, true)}
                          className="p-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 border border-amber-200"
                          title={language === 'bn' ? 'পেমেন্ট আদায়' : 'Mark paid'}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                        {item.status !== 'completed' && item.status !== 'no_show' ? (
                          <>
                            <button
                              onClick={() => setNoteAppt(item)}
                              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />{language === 'bn' ? 'নোট ও শেষ' : 'Note & Done'}
                            </button>
                            <button
                              onClick={() => handleNoShow(item.id)}
                              className="px-2 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              {language === 'bn' ? 'অনুপস্থিত' : 'No-show'}
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{item.status === 'no_show' ? (language === 'bn' ? 'অনুপস্থিত' : 'No-show') : t('chamber.action_done', 'Done')}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Notes modal */}
      {noteAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-slate-900">{language === 'bn' ? 'ভিজিট নোট' : 'Visit Note'} — #{noteAppt.serial} {noteAppt.patientName}</h3>
              <button onClick={() => setNoteAppt(null)} className="p-1.5 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} placeholder={language === 'bn' ? 'BP, পরামর্শ, ওষুধ...' : 'BP, advice, prescription note...'} className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setNoteAppt(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold">{language === 'bn' ? 'বাদ দিন' : 'Cancel'}</button>
              <button onClick={() => handleComplete(noteAppt.id, noteText)} className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-black">{language === 'bn' ? 'সম্পন্ন করুন' : 'Complete'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Walk-in modal */}
      {showWalkIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900">{language === 'bn' ? 'ওয়াক-ইন রোগী যোগ' : 'Add Walk-in Patient'}</h3>
              <button onClick={() => setShowWalkIn(false)} className="p-1.5 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <input value={walkName} onChange={e => setWalkName(e.target.value)} placeholder={language === 'bn' ? 'রোগীর নাম *' : 'Patient name *'} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
            <input value={walkPhone} onChange={e => setWalkPhone(e.target.value)} placeholder={language === 'bn' ? 'ফোন (ঐচ্ছিক)' : 'Phone (optional)'} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <select value={walkVisitType} onChange={e => setWalkVisitType(e.target.value)} className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white">
                <option value="new_consultation">{language === 'bn' ? 'নতুন ভিজিট' : 'New visit'}</option>
                <option value="followup">{language === 'bn' ? 'ফলো-আপ' : 'Follow-up'}</option>
              </select>
              <input value={walkComplaint} onChange={e => setWalkComplaint(e.target.value)} placeholder={language === 'bn' ? 'সমস্যা (ঐচ্ছিক)' : 'Complaint'} className="p-2.5 border border-slate-200 rounded-xl text-xs" />
            </div>
            <button onClick={handleWalkIn} disabled={!walkName.trim() || walkSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black disabled:opacity-50">{walkSaving ? '...' : (language === 'bn' ? 'সিরিয়াল দিন' : 'Add to Queue')}</button>
          </div>
        </div>
      )}
    </PageShell>
  );
};
