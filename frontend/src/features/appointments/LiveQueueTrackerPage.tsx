import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  User,
  AlertCircle,
  RefreshCw,
  Search,
  MapPin,
  Stethoscope,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Ticket,
  ChevronRight,
  ExternalLink,
  Sparkles,
  QrCode,
  Printer,
  X,
  Radio,
  ArrowRight
} from 'lucide-react';
import { doctorService } from '../doctors/services/doctorService';
import { appointmentService } from './services/appointmentService';
import { availabilityService } from '../availability/services/availabilityService';
import { Doctor } from '../doctors/types';
import { DoctorQueueResponse, Appointment } from './types';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { ChamberPassModal } from '../../components/ChamberPassModal';
import { PageShell, PageHero, EmptyState } from '../../components/Page';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface LiveQueueTrackerPageProps {
  onSelectDoctorForBooking?: (doctor: Doctor) => void;
  onOpenLogin?: () => void;
}

export const LiveQueueTrackerPage: React.FC<LiveQueueTrackerPageProps> = ({
  onSelectDoctorForBooking,
  onOpenLogin,
}) => {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);

  // Local calendar date (avoids UTC off-by-one near midnight)
  const toLocalDateStr = (d: Date = new Date()): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = toLocalDateStr();

  // Tracked queue date: today by default; jumps to the user's serial day for future bookings
  const [trackDate, setTrackDate] = useState<string>(todayStr);
  const isFutureTrack = trackDate !== todayStr;

  // Per-day availability for the strip (one schedule call per doctor)
  const [dayAvail, setDayAvail] = useState<Record<string, { free: number; total: number; hasShift: boolean }>>({});

  const loadDayAvailability = async (docId: string) => {
    try {
      const sched = await availabilityService.getDoctorSchedule(docId, 7, todayStr, undefined);
      const map: Record<string, { free: number; total: number; hasShift: boolean }> = {};
      for (const d of sched.days || []) {
        map[d.date] = { free: d.availableSlotsCount || 0, total: d.totalSlots || 0, hasShift: !!d.hasShift };
      }
      setDayAvail(map);
    } catch {
      setDayAvail({});
    }
  };

  // Dynamic live chamber queue for the selected doctor
  const [queueData, setQueueData] = useState<DoctorQueueResponse | null>(null);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState<boolean>(true);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [selectedSlipAppt, setSelectedSlipAppt] = useState<any | null>(null);

  // 1. Fetch all doctors and user's upcoming appointments
  useEffect(() => {
    fetchInitialData();
  }, [isAuthenticated]);

  const fetchInitialData = async () => {
    try {
      setIsLoadingDoctors(true);
      const docRes = await doctorService.getDoctors({ pageSize: 50 });
      const docs = docRes?.items || [];
      setAllDoctors(docs);

      if (docs.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docs[0].id);
      }

      if (isAuthenticated) {
        try {
          const appts = await appointmentService.getMyAppointments('upcoming');
          setMyAppointments(appts);
        } catch (e) {
          console.error('Failed to load user appointments', e);
        }
      }
    } catch (err) {
      console.error('Error fetching doctors for live tracker', err);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  // 2. Fetch live queue whenever selected doctor or tracked date changes
  const fetchDoctorQueue = async (docId: string, dateStr: string, showSpinner = false) => {
    if (!docId || !dateStr) return;
    try {
      if (showSpinner) setIsLoadingQueue(true);
      setIsRefreshing(true);
      const data = await appointmentService.getDoctorQueue(docId, dateStr);
      setQueueData(data);
    } catch (err) {
      console.error('Failed to fetch doctor live queue', err);
    } finally {
      if (showSpinner) setIsLoadingQueue(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedDoctorId) {
      setTrackDate(todayStr);
      setDayAvail({});
      fetchDoctorQueue(selectedDoctorId, todayStr, true);
      loadDayAvailability(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  // 3. Auto-polling every 12 seconds (live only for today's queue)
  useEffect(() => {
    if (!autoRefresh || !selectedDoctorId || isFutureTrack) return;
    const interval = setInterval(() => {
      fetchDoctorQueue(selectedDoctorId, trackDate, false);
    }, 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedDoctorId, trackDate, isFutureTrack]);

  // Filtered doctors list based on search query
  const filteredDoctors = allDoctors.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(q) ||
      doc.specialization.toLowerCase().includes(q) ||
      (doc.facilityName && doc.facilityName.toLowerCase().includes(q)) ||
      (doc.facility && doc.facility.toLowerCase().includes(q))
    );
  });

  const activeDoctor: Doctor | undefined = allDoctors.find((d) => d.id === selectedDoctorId) || allDoctors[0];

  // All non-cancelled bookings of the user with the selected doctor (any date)
  const myApptsForDoctor = myAppointments.filter(
    (a) => a.doctorId === selectedDoctorId && a.status !== 'cancelled'
  );
  const apptDateStr = (iso?: string): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : toLocalDateStr(d);
  };
  // Prefer the booking that belongs to the tracked date; fall back to the earliest upcoming
  const myApptForDoctor =
    myApptsForDoctor.find((a) => apptDateStr(a.startTime) === trackDate) || myApptsForDoctor[0];
  const myApptDate = myApptForDoctor ? apptDateStr(myApptForDoctor.startTime) : null;

  const totalAppts = queueData?.totalAppointments || 0;
  const runningSerial = queueData?.currentRunningSerial;
  const waitingCount = queueData?.waitingCount || 0;
  const completedCount = queueData?.completedCount || 0;
  const isPaused = queueData?.isPaused || false;
  const queueItems = queueData?.items || queueData?.queue || [];

  // "Mine" matched by appointment id (token numbers repeat across days)
  const myQueueItem = myApptForDoctor ? queueItems.find((i) => i.id === myApptForDoctor.id) : undefined;
  const mySerial = myQueueItem?.serial ?? myQueueItem?.tokenNumber ?? myApptForDoctor?.tokenNumber;

  // Queue progress + my line position (eye-visible "X of Y")
  const doneCount = queueItems.filter((i) => i.status === 'completed').length;
  const progressPct = totalAppts > 0 ? Math.round((doneCount / totalAppts) * 100) : 0;
  const activeItems = queueItems.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
  const myPosition =
    mySerial != null && myQueueItem && myQueueItem.status !== 'completed' && myQueueItem.status !== 'cancelled'
      ? activeItems.filter((i) => (i.serial ?? i.tokenNumber ?? 0) < mySerial).length + 1
      : null;

  // Avg consultation minutes derived from real slot durations (fallback 15)
  const avgSlotMin = (() => {
    const durs = queueItems
      .map((i) => (new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000)
      .filter((n) => n > 0 && n < 240);
    if (durs.length === 0) return 15;
    return Math.max(5, Math.round(durs.reduce((a, b) => a + b, 0) / durs.length));
  })();

  const runningItem = runningSerial != null
    ? queueItems.find((i) => (i.serial ?? i.tokenNumber) === runningSerial)
    : undefined;
  const aheadCount =
    mySerial != null && runningSerial != null && !isFutureTrack
      ? Math.max(0, mySerial - runningSerial)
      : null;
  // Approx turn clock-time: running slot start + ahead × avg duration (else booked time)
  const approxTurnDate =
    aheadCount != null && aheadCount > 0 && runningItem
      ? new Date(new Date(runningItem.startTime).getTime() + aheadCount * avgSlotMin * 60000)
      : myQueueItem
      ? new Date(myQueueItem.startTime)
      : null;
  const estWaitMin = aheadCount != null ? aheadCount * avgSlotMin : null;
  const fmtTime = (d: Date | null): string =>
    d && !isNaN(d.getTime())
      ? d.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      : '—';
  const fmtDay = (dateStr: string): string =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  // 7-day browsable strip (today + next 6 days): anyone can view the full
  // serial list of any day; patient names stay privacy-masked by the API.
  const addDaysLocal = (baseStr: string, n: number): string => {
    const d = new Date(`${baseStr}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toLocalDateStr(d);
  };
  const stripDays = Array.from({ length: 7 }, (_, i) => addDaysLocal(todayStr, i));
  const myDayOutsideStrip = myApptDate && !stripDays.includes(myApptDate) ? myApptDate : null;
  const jumpToDate = (dateStr: string) => {
    setTrackDate(dateStr);
    fetchDoctorQueue(selectedDoctorId, dateStr, true);
  };

  return (
    <PageShell>
      <PageHero
        eyebrow={
          `${language === 'bn' ? 'রিয়েল-টাইম লাইভ চেম্বার ট্র্যাকার' : 'Real-Time Chamber Queue Tracker'} · 📅 ${new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
        }
        title={<>{language === 'bn' ? 'লাইভ সিরিয়াল ট্র্যাকার ও চেম্বার কিউ' : 'Live Chamber Serial Tracker'}</>}
        subtitle={
          language === 'bn'
            ? 'ডাক্তার নির্বাচন করে রিয়েল-টাইম চলমান সিরিয়াল, অপেক্ষমাণ রোগীর সংখ্যা ও আনুমানিক অপেক্ষার সময় দেখুন।'
            : 'Select any specialist doctor to track the live running serial, waiting patient queue, and estimated consultation time.'
        }
        actions={
          <div className="flex items-center gap-2.5 bg-white/10 p-2 rounded-2xl border border-white/15">
            <button
              onClick={() => fetchDoctorQueue(selectedDoctorId, trackDate, true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                autoRefresh
                  ? 'bg-teal-500/20 text-teal-200 border-teal-400/40'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-teal-300 animate-pulse' : ''}`} />
              <span>{autoRefresh ? (language === 'bn' ? 'অটো-সিঙ্ক চালু' : 'Live Sync ON') : (language === 'bn' ? 'অটো-সিঙ্ক বন্ধ' : 'Live Sync OFF')}</span>
            </button>
          </div>
        }
      />

      {/* Main Layout: Doctor Selector Sidebar (Left) + Live Queue Board (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Doctor Selection (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="lift bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                <span>{language === 'bn' ? 'চিকিৎসক নির্বাচন করুন' : 'Select Specialist Doctor'}</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {filteredDoctors.length} {language === 'bn' ? 'জন ডাক্তার' : 'Doctors'}
              </span>
            </div>

            {/* Doctor Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={language === 'bn' ? 'ডাক্তারের নাম বা বিভাগ খুঁজুন...' : 'Search doctor or specialty...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Doctor List / Cards */}
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {isLoadingDoctors ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="p-3 bg-slate-50 rounded-2xl animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {language === 'bn' ? 'কোনো ডাক্তার পাওয়া যায়নি' : 'No doctors matching search'}
                </div>
              ) : (
                filteredDoctors.map((doc) => {
                  const isSelected = doc.id === selectedDoctorId;
                  const hasUserBooking = myAppointments.some((a) => a.doctorId === doc.id && a.status !== 'cancelled');

                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all border flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/80 border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <DoctorAvatar name={doc.name} profilePhotoUrl={doc.profilePhotoUrl} sizeClass="w-11 h-11 text-sm" />

                        <div className="truncate">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="font-bold text-xs text-slate-900 truncate">{doc.name}</span>
                            {hasUserBooking && (
                              <span className="bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                                {language === 'bn' ? 'আমার সিরিয়াল' : 'My Token'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-teal-700 font-semibold truncate">{doc.specialization}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{doc.facilityName || doc.facility || 'Popular Diagnostic'}</p>
                        </div>
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-teal-600 translate-x-0.5' : 'text-slate-300'}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Queue Board & Status for Selected Doctor (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeDoctor ? (
            <>
              {/* Doctor Details Header Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <DoctorAvatar name={activeDoctor.name} profilePhotoUrl={activeDoctor.profilePhotoUrl} sizeClass="w-16 h-16 text-xl" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-black text-slate-900">{activeDoctor.name}</h2>
                      <span className="bg-teal-50 text-teal-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-teal-200">
                        {activeDoctor.bmdcNumber || 'BMDC Verified'}
                      </span>
                    </div>
                    <p className="text-xs text-teal-700 font-bold">{activeDoctor.specialization}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {activeDoctor.facilityName || activeDoctor.facility || 'Popular Diagnostic Centre'} · <span className="font-bold text-slate-700">{activeDoctor.chamberRoom || activeDoctor.chamber || 'Room #301'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{language === 'bn' ? 'ভিজিট ফি' : 'Chamber Fee'}</span>
                    <span className="text-base font-extrabold text-slate-900">৳{activeDoctor.consultationFee || 1000}</span>
                  </div>

                  {onSelectDoctorForBooking && (
                    <button
                      onClick={() => onSelectDoctorForBooking(activeDoctor)}
                      className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'সিরিয়াল নিন' : 'Book Serial'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Active Booking Alert (serial with this doctor) */}
              {myApptForDoctor && mySerial != null && (
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-5 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-white text-amber-600 flex flex-col items-center justify-center font-black shrink-0 shadow">
                      <span className="text-[9px] uppercase tracking-wider">SERIAL</span>
                      <span className="text-xl leading-none">#{mySerial}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        {language === 'bn' ? 'এই চেম্বারে আপনার সিরিয়াল বুক করা আছে!' : 'You have a booked serial in this chamber!'}
                      </h3>
                      <p className="text-xs text-amber-100 font-medium mt-0.5">
                        {myApptDate && myApptDate !== todayStr
                          ? (language === 'bn'
                              ? `📅 আপনার সিরিয়াল ${fmtDay(myApptDate)} তারিখের (${myApptDate}) · সময় ≈ ${myQueueItem ? fmtTime(new Date(myQueueItem.startTime)) : '—'}`
                              : `📅 Your serial is on ${fmtDay(myApptDate)} (${myApptDate}) · booked time ≈ ${myQueueItem ? fmtTime(new Date(myQueueItem.startTime)) : '—'}`)
                          : aheadCount === 0
                          ? (language === 'bn' ? '🎉 আপনার সিরিয়াল চলছে! এখনই চেম্বারে প্রবেশ করুন।' : '🎉 It is your turn! Please enter the chamber now.')
                          : aheadCount != null && estWaitMin != null
                          ? (language === 'bn'
                              ? `আপনার আগে ${aheadCount} জন · আনুমানিক অপেক্ষা ~${estWaitMin} মিনিট · সম্ভাব্য ডাক ≈ ${fmtTime(approxTurnDate)}`
                              : `${aheadCount} ahead · est. wait ~${estWaitMin} min · your turn ≈ ${fmtTime(approxTurnDate)}`)
                          : (language === 'bn' ? 'সিরিয়াল নিশ্চিতকৃত অবস্থায় আছে।' : 'Serial is confirmed.')}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedSlipAppt(myApptForDoctor)}
                    className="px-4 py-2 bg-white text-amber-800 hover:bg-amber-50 rounded-xl text-xs font-black transition shadow flex items-center space-x-1.5 shrink-0 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-700" />
                    <span>{language === 'bn' ? 'আমার চেম্বার স্লিপ' : 'View Chamber Pass'}</span>
                  </button>
                </div>
              )}

              {/* Future serial nudge: booking exists on another day while tracking today */}
              {myApptDate && myApptDate !== todayStr && !isFutureTrack && (
                <button
                  onClick={() => jumpToDate(myApptDate)}
                  className="w-full p-4 rounded-3xl bg-blue-700 hover:bg-blue-600 text-white shadow flex items-center justify-between transition cursor-pointer"
                >
                  <span className="text-xs font-bold">
                    {language === 'bn'
                      ? `📅 আপনার সিরিয়াল #${mySerial} ${fmtDay(myApptDate)} (${myApptDate}) — ওই দিনের কিউ দেখুন`
                      : `📅 Your serial #${mySerial} is on ${fmtDay(myApptDate)} (${myApptDate}) — view that day's queue`}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              )}

              {/* Day browser: anyone can view this doctor's full serial list for any day.
                  Patient identities stay masked (API masks names for non-doctor roles). */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {language === 'bn' ? '📅 দিন বেছে সিরিয়াল তালিকা দেখুন' : 'Browse serial list by day'}
                </span>
                <div className="flex space-x-2.5 overflow-x-auto pb-2">
                  {stripDays.map((d) => {
                    const isSel = trackDate === d;
                    const isMine = myApptDate === d;
                    const isToday = d === todayStr;
                    const info = dayAvail[d];
                    return (
                      <button
                        key={d}
                        onClick={() => jumpToDate(d)}
                        className={`shrink-0 px-4 py-3 rounded-2xl text-center transition border cursor-pointer flex flex-col items-center justify-center min-w-[104px] shadow-sm ${
                          isSel
                            ? isMine
                              ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300'
                              : 'bg-slate-900 text-white border-slate-900 ring-2 ring-teal-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50'
                        }`}
                      >
                        <span className={`text-[11px] font-extrabold uppercase tracking-wide ${isSel ? 'text-white/80' : 'text-slate-400'}`}>
                          {isToday ? (language === 'bn' ? 'আজ' : 'Today') : fmtDay(d).split(' ')[0]}
                        </span>
                        <span className="text-sm font-black mt-0.5">{fmtDay(d)}</span>
                        <span className="mt-1.5 flex items-center gap-1">
                          {isMine && (
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${isSel ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                              {language === 'bn' ? 'আমার সিরিয়াল' : 'MY SERIAL'}
                            </span>
                          )}
                          {info && (
                            info.free > 0 ? (
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isSel ? 'bg-emerald-400/30 text-white border border-white/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                {info.free} {language === 'bn' ? 'ফাঁকা' : 'open'}
                              </span>
                            ) : info.hasShift ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSel ? 'bg-red-400/30 text-white border border-white/30' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                {language === 'bn' ? 'পূর্ণ' : 'Full'}
                              </span>
                            ) : (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {language === 'bn' ? 'বন্ধ' : 'Off'}
                              </span>
                            )
                          )}
                        </span>
                      </button>
                    );
                  })}
                  {myDayOutsideStrip && (
                    <button
                      onClick={() => jumpToDate(myDayOutsideStrip)}
                      className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer flex flex-col items-center min-w-[86px] ${
                        trackDate === myDayOutsideStrip
                          ? 'bg-amber-500 text-white border-amber-500 shadow'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500'
                      }`}
                    >
                      <span className="text-[10px] uppercase opacity-80">{language === 'bn' ? 'আমার সিরিয়াল' : 'My serial'}</span>
                      <span>{fmtDay(myDayOutsideStrip)}</span>
                    </button>
                  )}
                </div>
                {isFutureTrack && (
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {language === 'bn'
                      ? 'লাইভ চলমান সিরিয়াল ওই দিন সক্রিয় হবে · নাম গোপন রাখা আছে'
                      : 'Live running serial activates on that day · names kept private'}
                  </span>
                )}
              </div>

              {/* Pause Alert (If Doctor is on Break) */}
              {isPaused && (
                <div className="bg-amber-50 border border-amber-300 rounded-3xl p-5 flex items-center space-x-3.5 text-amber-900">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
                      {language === 'bn' ? 'চেম্বার সাময়িক বিরতিতে আছে (Doctor on Break)' : 'Chamber is Temporarily on Break'}
                    </h4>
                    <p className="text-xs font-medium text-amber-700 mt-0.5">
                      {queueData?.pauseMessage || (language === 'bn' ? 'ডাক্তার সাময়িক বিরতিতে আছেন। কিছুক্ষণের মধ্যে সিরিয়াল পুনরায় চালু হবে।' : 'The doctor is currently taking a short clinical break. Queue will resume shortly.')}
                    </p>
                  </div>
                </div>
              )}

              {/* Main Live Queue Status Board */}
              {isLoadingQueue ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-600">{language === 'bn' ? 'চেম্বার কিউ লোড হচ্ছে...' : 'Fetching live chamber queue...'}</p>
                </div>
              ) : totalAppts === 0 ? (
                /* Dynamic Empty / Idle State */
                <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Activity className="w-8 h-8 text-slate-400" />
                  </div>

                  <div className="max-w-md mx-auto space-y-1">
                    <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                      {language === 'bn' ? 'চেম্বার খালি · কোনো চলমান সিরিয়াল নেই' : 'Chamber Idle · No Active Serials'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-800 pt-2">
                      {isFutureTrack
                        ? (language === 'bn' ? `${fmtDay(trackDate)} (${trackDate}) — এখনো কোনো সিরিয়াল বুকিং নেই` : `No serials booked for ${fmtDay(trackDate)} (${trackDate}) yet`)
                        : (language === 'bn' ? 'আজকের জন্য কোনো রোগী বা সিরিয়াল চলমান নেই' : 'No active serial or patients in queue today')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {language === 'bn'
                        ? `ডাঃ ${activeDoctor.name} এর চেম্বারে আজকের কোনো সিরিয়াল বুকিং নেই। আপনি এখনই প্রথম সিরিয়ালটি বুক করতে পারেন।`
                        : `There are currently no patient serials booked or running for Dr. ${activeDoctor.name} today. You can be the first to book.`}
                    </p>
                  </div>

                  {onSelectDoctorForBooking && (
                    <div className="pt-2">
                      <button
                        onClick={() => onSelectDoctorForBooking(activeDoctor)}
                        className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-extrabold transition shadow-md inline-flex items-center space-x-2 cursor-pointer"
                      >
                        <Ticket className="w-4 h-4" />
                        <span>{language === 'bn' ? 'এখনই সিরিয়াল বুকিং করুন' : 'Book a Serial Now'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Dynamic Active Queue Board */
                <div className="space-y-6">
                  {/* Highlighted Big Status Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Currently Running Serial Card (live only for today) */}
                    <div className="bg-gradient-to-br from-teal-700 to-slate-900 text-white rounded-3xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black tracking-widest text-teal-300">
                          {isFutureTrack
                            ? (language === 'bn' ? 'নির্ধারিত সিরিয়াল' : 'SCHEDULED SERIALS')
                            : (language === 'bn' ? 'চলমান সিরিয়াল' : 'CURRENT RUNNING')}
                        </span>
                        {!isFutureTrack && (
                          <span className="flex items-center space-x-1 bg-teal-500/30 text-teal-200 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-teal-400/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>LIVE</span>
                          </span>
                        )}
                      </div>

                      <div className="my-3">
                        <div className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                          {isFutureTrack ? `#${mySerial ?? '—'}` : (runningSerial ? `#${runningSerial}` : '—')}
                        </div>
                        <p className="text-xs text-teal-200 font-medium mt-1 truncate">
                          {isFutureTrack
                            ? (language === 'bn' ? `লাইভ ${fmtDay(trackDate)} সক্রিয় হবে` : `Live starts ${fmtDay(trackDate)}`)
                            : (queueData?.currentRunningPatientName || (language === 'bn' ? 'চেম্বার প্রস্তুত' : 'Ready for Patient'))}
                        </p>
                      </div>

                      <div className="text-[11px] text-teal-300 font-bold flex items-center space-x-1">
                        <Activity className="w-3.5 h-3.5" />
                        <span>
                          {isFutureTrack
                            ? (language === 'bn' ? 'আপনার বুকড সিরিয়াল' : 'Your booked serial')
                            : (language === 'bn' ? 'পরামর্শ চলছে (In Chamber)' : 'In Consultation')}
                        </span>
                      </div>

                      {/* Day progress: completed share of all serials */}
                      {!isFutureTrack && totalAppts > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] font-bold text-teal-200 mb-1">
                            <span>{language === 'bn' ? `অগ্রগতি ${doneCount}/${totalAppts}` : `Progress ${doneCount}/${totalAppts}`}</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Waiting / Booked Count */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        {isFutureTrack
                          ? (language === 'bn' ? 'বুকড সিরিয়াল' : 'BOOKED SERIALS')
                          : (language === 'bn' ? 'অপেক্ষমাণ রোগী' : 'WAITING IN QUEUE')}
                      </span>
                      <div className="my-2">
                        <div className="text-3xl sm:text-4xl font-black text-amber-600">
                          {waitingCount} <span className="text-xs font-bold text-slate-400">{language === 'bn' ? 'জন' : 'patients'}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {language === 'bn' ? `গড় অপেক্ষার সময়: ~${waitingCount * avgSlotMin} মিনিট` : `Est. remaining: ~${waitingCount * avgSlotMin} mins`}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400 font-bold flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{language === 'bn' ? 'পরবর্তী সিরিয়াল ডাকছে' : 'Next in line'}</span>
                      </div>
                    </div>

                    {/* Completed Consultations Count */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        {language === 'bn' ? 'পরামর্শ সম্পন্ন' : 'COMPLETED TODAY'}
                      </span>
                      <div className="my-2">
                        <div className="text-3xl sm:text-4xl font-black text-emerald-700">
                          {completedCount} <span className="text-xs font-bold text-slate-400">{language === 'bn' ? 'জন' : 'done'}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {language === 'bn' ? `মোট সিরিয়াল: ${totalAppts} টি` : `Total booked: ${totalAppts}`}
                        </p>
                      </div>
                      <div className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'সফল চিকিৎসা' : 'Consultations Done'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Patient Queue Sequence List */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {isFutureTrack
                            ? (language === 'bn' ? `${fmtDay(trackDate)}-এর সিরিয়াল তালিকা` : `Queue for ${fmtDay(trackDate)} (${trackDate})`)
                            : (language === 'bn' ? 'আজকের চেম্বার সিরিয়াল তালিকা (Queue Order)' : 'Today\'s Patient Queue Order')}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {language === 'bn' ? 'গোপনীয়তা রক্ষার্থে রোগীর নাম সুরক্ষিতভাবে আড়াল করা আছে' : 'Patient names are privacy-masked for public tracking'}
                        </p>
                      </div>
                      <span className="text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                        {queueItems.length} {language === 'bn' ? 'টি সিরিয়াল' : 'Tokens'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {queueItems.map((item) => {
                        const serial = item.serial ?? item.tokenNumber;
                        // "In chamber" can only be true for today's live queue, never a future day
                        const isCurrent = !isFutureTrack && (serial === runningSerial || item.status === 'in_consultation' || item.status === 'in_chamber');
                        const isDone = item.status === 'completed';
                        const isMyToken = myApptForDoctor != null && item.id === myApptForDoctor.id;
                        const aheadForRow =
                          isMyToken && aheadCount != null ? aheadCount
                          : runningSerial != null && serial != null && !isFutureTrack && serial > runningSerial
                          ? serial - runningSerial
                          : null;

                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isCurrent
                                ? 'bg-teal-50/90 border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                                : isMyToken
                                ? 'bg-amber-50/80 border-amber-400 shadow-sm'
                                : isDone
                                ? 'bg-slate-50/70 border-slate-200 opacity-60'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              {/* Serial Badge — large, high-contrast */}
                              <div
                                className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                                  isCurrent
                                    ? 'bg-teal-700 text-white shadow'
                                    : isMyToken
                                    ? 'bg-amber-500 text-white shadow'
                                    : isDone
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                #{item.serial || item.tokenNumber}
                              </div>

                              <div>
                                <div className="flex items-center space-x-2 flex-wrap">
                                  <span className="font-extrabold text-sm text-slate-900">
                                    {isMyToken ? (language === 'bn' ? 'আপনি (Your Serial)' : 'You (Your Serial)') : item.patientName}
                                  </span>
                                  {isMyToken && (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300">
                                      MY PASS
                                    </span>
                                  )}
                                  {isMyToken && myPosition != null && (
                                    <span className="bg-slate-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                      {language === 'bn' ? `লাইনে ${myPosition}/${activeItems.length}` : `#${myPosition} of ${activeItems.length} in line`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                  {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.visitType === 'followup' ? (language === 'bn' ? 'ফলো-আপ' : 'Followup') : (language === 'bn' ? 'নতুন রোগী' : 'New Patient')}
                                  {aheadForRow != null && aheadForRow > 0 && !isDone && (
                                    <span className="font-bold text-teal-700">
                                      {' '}· {aheadForRow} {language === 'bn' ? 'জন পরে' : 'after running'} · ≈{aheadForRow * avgSlotMin} {language === 'bn' ? 'মিনিট' : 'min'}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {isCurrent ? (
                                <span className="flex items-center space-x-1.5 bg-teal-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  <span>{language === 'bn' ? 'পরামর্শ চলছে' : 'In Chamber'}</span>
                                </span>
                              ) : isDone ? (
                                <span className="flex items-center space-x-1 text-slate-500 text-[10px] font-bold bg-slate-200 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{language === 'bn' ? 'সম্পন্ন' : 'Completed'}</span>
                                </span>
                              ) : (
                                <span className="text-amber-700 text-[10px] font-extrabold bg-amber-100/80 px-2.5 py-1 rounded-full border border-amber-200">
                                  {isFutureTrack
                                    ? (language === 'bn' ? 'বুকড' : 'Booked')
                                    : (language === 'bn' ? 'অপেক্ষমাণ' : 'Waiting')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Stethoscope className="w-8 h-8" />}
              title={language === 'bn' ? 'ডাক্তার নির্বাচন করুন' : 'Select a doctor'}
              body={language === 'bn' ? 'বাম পাশের তালিকা থেকে একজন ডাক্তার নির্বাচন করুন।' : 'Please select a doctor from the list.'}
            />
          )}
        </div>
      </div>

      {/* Chamber Pass (shared component) */}
      {selectedSlipAppt && (
        <ChamberPassModal appt={selectedSlipAppt} onClose={() => setSelectedSlipAppt(null)} />
      )}

    </PageShell>
  );
};
