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
import { Doctor } from '../doctors/types';
import { DoctorQueueResponse, Appointment } from './types';
import { DoctorAvatar } from '../../components/DoctorAvatar';
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
      fetchDoctorQueue(selectedDoctorId, todayStr, true);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1.5 bg-teal-500/20 text-teal-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-teal-500/30">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                <span>{language === 'bn' ? 'রিয়েল-টাইম লাইভ চেম্বার ট্র্যাকার' : 'Real-Time Chamber Queue Tracker'}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline-block">
                📅 {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {language === 'bn' ? 'লাইভ সিরিয়াল ট্র্যাকার ও চেম্বার কিউ' : 'Live Chamber Serial Tracker'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              {language === 'bn'
                ? 'ডাক্তার নির্বাচন করে রিয়েল-টাইম চলমান সিরিয়াল, অপেক্ষমাণ রোগীর সংখ্যা ও আনুমানিক অপেক্ষার সময় দেখুন।'
                : 'Select any specialist doctor to track the live running serial, waiting patient queue, and estimated consultation time.'}
            </p>
          </div>

          {/* Quick Refresh & Auto-Sync Controls */}
          <div className="flex items-center space-x-3 bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 self-start md:self-auto">
            <button
              onClick={() => fetchDoctorQueue(selectedDoctorId, trackDate, true)}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                autoRefresh
                  ? 'bg-teal-900/50 text-teal-300 border-teal-500/40'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-teal-400 animate-pulse' : ''}`} />
              <span>{autoRefresh ? (language === 'bn' ? 'অটো-সিঙ্ক চালু' : 'Live Sync ON') : (language === 'bn' ? 'অটো-সিঙ্ক বন্ধ' : 'Live Sync OFF')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Doctor Selector Sidebar (Left) + Live Queue Board (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Doctor Selection (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
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
                  onClick={() => {
                    setTrackDate(myApptDate);
                    fetchDoctorQueue(selectedDoctorId, myApptDate, true);
                  }}
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

              {/* Tracked-date selector: Today vs my serial day */}
              {myApptDate && myApptDate !== todayStr && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setTrackDate(todayStr);
                      fetchDoctorQueue(selectedDoctorId, todayStr, true);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      !isFutureTrack
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {language === 'bn' ? 'আজকের লাইভ কিউ' : 'Today Live'}
                  </button>
                  <button
                    onClick={() => {
                      setTrackDate(myApptDate);
                      fetchDoctorQueue(selectedDoctorId, myApptDate, true);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      isFutureTrack
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {language === 'bn' ? `আমার সিরিয়াল · ${fmtDay(myApptDate)}` : `My serial day · ${fmtDay(myApptDate)}`}
                  </button>
                  {isFutureTrack && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      {language === 'bn'
                        ? 'লাইভ চলমান সিরিয়াল ওই দিন সক্রিয় হবে'
                        : 'Live running serial activates on that day'}
                    </span>
                  )}
                </div>
              )}

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
                    {/* Currently Running Serial Card */}
                    <div className="bg-gradient-to-br from-teal-700 to-slate-900 text-white rounded-3xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black tracking-widest text-teal-300">
                          {language === 'bn' ? 'চলমান সিরিয়াল' : 'CURRENT RUNNING'}
                        </span>
                        <span className="flex items-center space-x-1 bg-teal-500/30 text-teal-200 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-teal-400/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>LIVE</span>
                        </span>
                      </div>

                      <div className="my-3">
                        <div className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                          {runningSerial ? `#${runningSerial}` : '—'}
                        </div>
                        <p className="text-xs text-teal-200 font-medium mt-1 truncate">
                          {queueData?.currentRunningPatientName || (language === 'bn' ? 'চেম্বার প্রস্তুত' : 'Ready for Patient')}
                        </p>
                      </div>

                      <div className="text-[11px] text-teal-300 font-bold flex items-center space-x-1">
                        <Activity className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'পরামর্শ চলছে (In Chamber)' : 'In Consultation'}</span>
                      </div>
                    </div>

                    {/* Waiting Patients Count */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        {language === 'bn' ? 'অপেক্ষমাণ রোগী' : 'WAITING IN QUEUE'}
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
                        const isCurrent = serial === runningSerial || item.status === 'in_consultation' || item.status === 'in_chamber';
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
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                              isCurrent
                                ? 'bg-teal-50/90 border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                                : isMyToken
                                ? 'bg-amber-50/80 border-amber-400 shadow-sm'
                                : isDone
                                ? 'bg-slate-50/70 border-slate-200 opacity-60'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3.5">
                              {/* Serial Badge */}
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
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
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-xs text-slate-900">
                                    {isMyToken ? (language === 'bn' ? 'আপনি (Your Serial)' : 'You (Your Serial)') : item.patientName}
                                  </span>
                                  {isMyToken && (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                      MY PASS
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium">
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
                                  {language === 'bn' ? 'অপেক্ষমাণ' : 'Waiting'}
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
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">{language === 'bn' ? 'বাম পাশের তালিকা থেকে একজন ডাক্তার নির্বাচন করুন।' : 'Please select a doctor from the list.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Printable Chamber Pass / Slip Modal */}
      {selectedSlipAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setSelectedSlipAppt(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 inline-block mb-3">
                {language === 'bn' ? 'অফিসিয়াল চেম্বার প্রবেশ পাস' : 'Official Chamber Pass'}
              </span>

              {/* Token Number Display */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-slate-900 to-teal-900 text-white flex flex-col items-center justify-center mx-auto shadow-xl my-2 border-2 border-teal-400/30">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">SERIAL</span>
                <span className="text-3xl font-black">#{selectedSlipAppt.tokenNumber}</span>
              </div>

              <h3 className="text-base font-black text-slate-900 mt-2">{selectedSlipAppt.doctorName}</h3>
              <p className="text-xs text-teal-700 font-semibold">{selectedSlipAppt.specialization}</p>

              {/* QR Code Pass */}
              <div className="my-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
                <div className="w-28 h-28 bg-white p-2 rounded-xl flex items-center justify-center border border-slate-200 mx-auto">
                  <div className="w-full h-full border-2 border-dashed border-slate-800 rounded flex flex-col items-center justify-center text-center p-1">
                    <QrCode className="w-12 h-12 text-slate-900" />
                    <span className="text-[8px] font-mono font-bold text-slate-600 mt-1">TOKEN-{selectedSlipAppt.tokenNumber}</span>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block mt-1 tracking-wider">
                  SCAN AT CLINIC DESK
                </span>
              </div>

              {/* Chamber Details */}
              <div className="bg-slate-50 rounded-2xl p-3 text-left space-y-1.5 border border-slate-100 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Scheduled Time:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedSlipAppt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Consultation Fee:</span>
                  <span className="font-extrabold text-teal-700">৳{selectedSlipAppt.fee || 1000}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment:</span>
                  <span className="font-bold text-amber-700 uppercase text-[10px]">PAY AT CHAMBER</span>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{language === 'bn' ? 'প্রিন্ট অথবা সেভ স্লিপ' : 'Print / Download Slip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
