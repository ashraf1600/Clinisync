import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Zap,
  CheckCircle,
  AlertTriangle,
  Shield,
  User,
  Ban,
  Building2,
  MapPin,
  Stethoscope,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  Eye,
  Check,
  ChevronRight,
  X
} from 'lucide-react';
import { doctorService } from '../doctors/services/doctorService';
import { availabilityService } from './services/availabilityService';
import { Doctor, DoctorChamberLocation } from '../doctors/types';
import { ChamberShift, TimeSlot } from './types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getDoctorChambers } from '../doctors/utils/chamberUtils';

export const ScheduleManagerPage: React.FC = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [locations, setLocations] = useState<DoctorChamberLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [shifts, setShifts] = useState<ChamberShift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState<boolean>(false);

  // Shift & Slot Generation Parameters
  const [rangeHorizon, setRangeHorizon] = useState<'week' | 'month'>('month');
  const [slotDuration, setSlotDuration] = useState<number>(20);
  const [bufferMinutes, setBufferMinutes] = useState<number>(5);
  const [startTime, setStartTime] = useState<string>('17:00');
  const [endTime, setEndTime] = useState<string>('21:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([6, 1, 3]); // Default Sat, Mon, Wed

  const [generating, setGenerating] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dedicated "Add Slot Time for Chamber" Modal state
  const [showAddShiftModal, setShowAddShiftModal] = useState<boolean>(false);
  const [targetChamberForShift, setTargetChamberForShift] = useState<DoctorChamberLocation | null>(null);
  const [modalDays, setModalDays] = useState<number[]>([6, 0, 1]); // Sat, Sun, Mon
  const [modalStartTime, setModalStartTime] = useState<string>('17:00');
  const [modalEndTime, setModalEndTime] = useState<string>('21:00');
  const [modalDuration, setModalDuration] = useState<number>(20);
  const [modalBuffer, setModalBuffer] = useState<number>(5);
  const [isSavingShift, setIsSavingShift] = useState<boolean>(false);

  // New Hospital Modal / Form state
  const [showAddLocationModal, setShowAddLocationModal] = useState<boolean>(false);
  const [newFacilityName, setNewFacilityName] = useState<string>('');
  const [newBranchArea, setNewBranchArea] = useState<string>('');
  const [newChamberRoom, setNewChamberRoom] = useState<string>('');
  const [newFee, setNewFee] = useState<number>(1200);
  const [isAddingLocation, setIsAddingLocation] = useState<boolean>(false);

  // Exception Blocker state
  const [exceptionDate, setExceptionDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [exceptionReason, setExceptionReason] = useState<string>('Weekly Hospital Holiday / Academic Conference');
  const [blockingDate, setBlockingDate] = useState<boolean>(false);

  // Live Slot Tester state
  const [testDate, setTestDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [testSlots, setTestSlots] = useState<TimeSlot[]>([]);
  const [loadingTestSlots, setLoadingTestSlots] = useState<boolean>(false);

  const daysMap = [
    { day: 6, label: language === 'bn' ? 'শনি (Sat)' : 'Saturday', short: 'Sat' },
    { day: 0, label: language === 'bn' ? 'রবি (Sun)' : 'Sunday', short: 'Sun' },
    { day: 1, label: language === 'bn' ? 'সোম (Mon)' : 'Monday', short: 'Mon' },
    { day: 2, label: language === 'bn' ? 'মঙ্গল (Tue)' : 'Tuesday', short: 'Tue' },
    { day: 3, label: language === 'bn' ? 'বুধ (Wed)' : 'Wednesday', short: 'Wed' },
    { day: 4, label: language === 'bn' ? 'বৃহস্পতি (Thu)' : 'Thursday', short: 'Thu' },
    { day: 5, label: language === 'bn' ? 'শুক্র (Fri)' : 'Friday', short: 'Fri' },
  ];

  // Preset Shift Templates
  const shiftPresets = [
    {
      name: language === 'bn' ? 'সকালের ওপিডি (Morning OPD)' : 'Morning OPD',
      start: '09:00',
      end: '13:00',
      days: [6, 1, 3], // Sat, Mon, Wed
      desc: 'Evercare / DMCH Morning OPD',
    },
    {
      name: language === 'bn' ? 'সন্ধ্যার চেম্বার (Evening Clinic)' : 'Evening Clinic',
      start: '17:00',
      end: '21:00',
      days: [0, 2, 4], // Sun, Tue, Thu
      desc: 'Square / Popular Evening Clinic',
    },
    {
      name: language === 'bn' ? 'শুক্রবার স্পেশাল (Friday Special)' : 'Friday Special',
      start: '10:00',
      end: '14:00',
      days: [5], // Friday
      desc: 'Labaid Weekend Special',
    },
    {
      name: language === 'bn' ? 'দৈনিক পরামর্শ (Daily Shift)' : 'Daily Shift',
      start: '16:00',
      end: '20:00',
      days: [6, 0, 1, 2, 3, 4], // Sat - Thu
      desc: 'Standard 6-day practice',
    },
  ];

  const loadShiftsForDoctor = async (docId: string) => {
    try {
      setLoadingShifts(true);
      const res = await availabilityService.getShifts(docId);
      setShifts(res || []);
    } catch (err) {
      console.error('Failed to load doctor shifts', err);
    } finally {
      setLoadingShifts(false);
    }
  };

  const loadDoctors = async () => {
    try {
      const res = await doctorService.getDoctors({ pageSize: 50 });
      const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setDoctors(items);
      if (items.length > 0) {
        const selfDoc = items.find((d) => d.userId === user?.id);
        const targetDoc = selfDoc || items[0];
        setSelectedDoctorId(targetDoc.id);
        setActiveDoctor(targetDoc);
        const docChambers = getDoctorChambers(targetDoc);
        setLocations(docChambers);
        if (docChambers.length > 0) {
          setSelectedLocationId(docChambers[0].id);
        }
        await loadShiftsForDoctor(targetDoc.id);
      }
    } catch (err) {
      console.error('Failed to load doctors in schedule manager', err);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, [user]);

  // When selected doctor changes, load their locations and shifts
  const handleDoctorChange = async (docId: string) => {
    setSelectedDoctorId(docId);
    const doc = doctors.find((d) => d.id === docId);
    if (doc) {
      setActiveDoctor(doc);
      try {
        const docLocs = await doctorService.getDoctorLocations(docId);
        if (docLocs && docLocs.length > 0) {
          setLocations(docLocs);
          setSelectedLocationId(docLocs[0].id);
        } else {
          const fallback = getDoctorChambers(doc);
          setLocations(fallback);
          if (fallback.length > 0) setSelectedLocationId(fallback[0].id);
        }
      } catch {
        const docChambers = getDoctorChambers(doc);
        setLocations(docChambers);
        if (docChambers.length > 0) setSelectedLocationId(docChambers[0].id);
      }
      await loadShiftsForDoctor(docId);
    }
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleModalDay = (day: number) => {
    if (modalDays.includes(day)) {
      setModalDays(modalDays.filter((d) => d !== day));
    } else {
      setModalDays([...modalDays, day]);
    }
  };

  const applyPreset = (preset: typeof shiftPresets[0]) => {
    setStartTime(preset.start);
    setEndTime(preset.end);
    setSelectedDays(preset.days);
  };

  const applyModalPreset = (preset: typeof shiftPresets[0]) => {
    setModalStartTime(preset.start);
    setModalEndTime(preset.end);
    setModalDays(preset.days);
  };

  // Calculate live preview of slots
  const calculateSlotPreview = (start: string, end: string, duration: number, buffer: number) => {
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      let currMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      const preview: string[] = [];

      while (currMin + duration <= endMin && preview.length < 30) {
        const h = Math.floor(currMin / 60);
        const m = currMin % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const timeStr = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
        preview.push(timeStr);
        currMin += duration + buffer;
      }
      return preview;
    } catch {
      return [];
    }
  };

  const modalSlotPreview = calculateSlotPreview(modalStartTime, modalEndTime, modalDuration, modalBuffer);

  // Open "Add Slot Time" modal for a specific chamber
  const handleOpenAddShiftModal = (chamber: DoctorChamberLocation) => {
    setTargetChamberForShift(chamber);
    setShowAddShiftModal(true);
  };

  // Submit Slot Time creation for a chamber
  const handleSaveChamberShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !targetChamberForShift || modalDays.length === 0) return;

    try {
      setIsSavingShift(true);
      setStatusFeedback(null);

      const payload = {
        locationId: targetChamberForShift.id,
        daysOfWeek: modalDays,
        startTime: modalStartTime,
        endTime: modalEndTime,
        slotDurationMinutes: modalDuration,
        bufferMinutes: modalBuffer,
        isActive: true,
      };

      await availabilityService.addShifts(selectedDoctorId, payload);
      await loadShiftsForDoctor(selectedDoctorId);

      setShowAddShiftModal(false);
      setStatusFeedback({
        type: 'success',
        text: `Slot time (${modalStartTime} - ${modalEndTime}) successfully added for ${targetChamberForShift.facilityName} (${modalDays.length} days selected).`,
      });
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Failed to add chamber slot time',
      });
    } finally {
      setIsSavingShift(false);
    }
  };

  // Delete a specific shift slot time
  const handleDeleteShift = async (shiftId: string, shiftDesc: string) => {
    if (!selectedDoctorId) return;
    if (!confirm(`Are you sure you want to remove slot time "${shiftDesc}"?`)) return;

    try {
      await availabilityService.deleteShift(selectedDoctorId, shiftId);
      await loadShiftsForDoctor(selectedDoctorId);
      setStatusFeedback({
        type: 'success',
        text: `Shift slot time removed successfully.`,
      });
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to delete shift slot time',
      });
    }
  };

  // Handle adding new hospital chamber location (Doctor & Admin support)
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacilityName.trim() || !selectedDoctorId) return;

    try {
      setIsAddingLocation(true);
      const payload = {
        facilityName: newFacilityName.trim(),
        branchArea: newBranchArea.trim() || 'Dhaka Branch',
        chamberRoom: newChamberRoom.trim() || 'Room #201',
        consultationFee: newFee,
        contactPhone: '+880 1711-000000',
        isActive: true,
      };

      const newLoc = await doctorService.createDoctorLocation(selectedDoctorId, payload);
      const updatedLocs = [...locations, newLoc];
      setLocations(updatedLocs);
      setSelectedLocationId(newLoc.id);

      setShowAddLocationModal(false);
      setNewFacilityName('');
      setNewBranchArea('');
      setNewChamberRoom('');
      setStatusFeedback({
        type: 'success',
        text: `Hospital chamber "${newLoc.facilityName}" added successfully. You can now add slot times for it.`,
      });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add hospital location.');
    } finally {
      setIsAddingLocation(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!selectedDoctorId) return;
    setGenerating(true);
    setStatusFeedback(null);

    const today = new Date();
    const startDateStr = today.toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setDate(today.getDate() + (rangeHorizon === 'month' ? 30 : 7));
    const endDateStr = endDate.toISOString().split('T')[0];

    const targetLoc = locations.find((l) => l.id === selectedLocationId);

    try {
      const res = await availabilityService.bulkGenerate(selectedDoctorId, {
        targetRange: rangeHorizon,
        startDate: startDateStr,
        endDate: endDateStr,
        locationId: selectedLocationId || undefined,
        daysOfWeek: selectedDays,
        startTime,
        endTime,
        slotDurationMinutes: slotDuration,
        bufferMinutes,
        applyHolidays: true,
      });

      await loadShiftsForDoctor(selectedDoctorId);

      setStatusFeedback({
        type: 'success',
        text: `Success! ${res.totalSlotsCreated} slots generated for ${targetLoc?.facilityName || 'Chamber'} (${startTime} - ${endTime}) across ${res.workingDaysCount} working days.`,
      });
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Failed to generate slots',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleBlockDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !exceptionDate) return;
    setBlockingDate(true);
    setStatusFeedback(null);

    try {
      await availabilityService.addException(selectedDoctorId, {
        exceptionDate,
        isAvailable: false,
        reason: exceptionReason,
      });

      setStatusFeedback({
        type: 'success',
        text: `Date ${exceptionDate} successfully marked as blocked holiday (${exceptionReason}).`,
      });
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Failed to block date exception',
      });
    } finally {
      setBlockingDate(false);
    }
  };

  // Test live slot generation for date and selected chamber
  const handleTestSlots = async () => {
    if (!selectedDoctorId) return;
    try {
      setLoadingTestSlots(true);
      const res = await availabilityService.getSlots(selectedDoctorId, testDate, selectedLocationId || undefined);
      setTestSlots(res.slots || []);
    } catch {
      setTestSlots([]);
    } finally {
      setLoadingTestSlots(false);
    }
  };

  useEffect(() => {
    if (selectedDoctorId) {
      handleTestSlots();
    }
  }, [selectedDoctorId, selectedLocationId, testDate]);

  const selectedChamber = locations.find((l) => l.id === selectedLocationId) || locations[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center space-x-1.5 bg-blue-500/20 text-blue-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-blue-500/30">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>{language === 'bn' ? 'চেম্বার ও স্লট কন্ট্রোল' : 'Multi-Chamber Slot & Shift Engine'}</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {language === 'bn' ? 'প্রতি চেম্বারে স্লট ও সময়সূচী ব্যবস্থাপনা' : 'Chamber Slot Time & Shift Manager'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              {language === 'bn'
                ? 'ডাক্তার বা এডমিন হিসেবে প্রতিটি চেম্বারের জন্য নির্দিষ্ট দিন, শুরু ও শেষের সময়, এবং রোগী দেখার স্লট সময় নির্ধারণ করুন।'
                : 'Configure dedicated slot times and shifts for each consultation chamber (Evercare, Square, Popular) with full doctor and admin control.'}
            </p>
          </div>

          {user?.role === 'admin' && (
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 max-w-sm w-full shadow-lg">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5 mb-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Doctor (Administrator Mode):</span>
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => handleDoctorChange(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialization})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Admin can add chambers and slot times for any doctor.
              </p>
            </div>
          )}
        </div>
      </div>

      {shifts.length === 0 && !loadingShifts && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-900">
                {language === 'bn'
                  ? 'এই ডাক্তারের কোনো চেম্বার স্লট কনফিগার করা হয়নি'
                  : 'No chamber slots configured for this doctor'}
              </p>
              <p className="text-xs text-amber-800 mt-1">
                {language === 'bn'
                  ? 'ডিফল্ট ১৭:০০–২১:০০ দেখানো হচ্ছে। রোগীরা সঠিক সময়ে বুক করতে "স্লট সময় যোগ করুন" দিয়ে আসল সময় সেট করুন।'
                  : 'Default 17:00–21:00 is shown for preview. Add real slot times with “Add Slot Time” so patients book the correct hours.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const first = locations[0];
              if (first) handleOpenAddShiftModal(first);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow cursor-pointer shrink-0"
          >
            {language === 'bn' ? 'প্রথম স্লট যোগ করুন' : 'Add First Slot Time'}
          </button>
        </div>
      )}

      {statusFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-2 border shadow-sm transition-all ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusFeedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* SECTION 1: EVERY CHAMBER CARDS WITH DIRECT "ADD SLOT TIME" */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 inline-block">
                All Chambers ({locations.length})
              </span>
              <span className="text-xs text-slate-400">
                Doctor: <strong className="text-slate-800">{activeDoctor?.name}</strong>
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1">
              {language === 'bn' ? 'সকল চেম্বার ও স্লট সময়সূচী' : 'Chambers & Configured Slot Times'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'bn'
                ? 'যেকোনো চেম্বারে নতুন স্লট সময় যোগ করতে "স্লট সময় যোগ করুন" বোতামে চাপ দিন'
                : 'Click "Add Slot Time" on any chamber to configure specific shift hours, duration, and days.'}
            </p>
          </div>

          <button
            onClick={() => setShowAddLocationModal(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'bn' ? 'নতুন চেম্বার যোগ করুন' : 'Add New Chamber'}</span>
          </button>
        </div>

        {/* Chambers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {locations.map((loc) => {
            const isSelected = loc.id === selectedLocationId;
            const chamberShifts = shifts.filter((s) => s.locationId === loc.id || (!s.locationId && locations[0]?.id === loc.id));

            return (
              <div
                key={loc.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50/40 border-blue-500 shadow-md ring-2 ring-blue-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Chamber Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                        🏥
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 line-clamp-1">{loc.facilityName}</h3>
                        <p className="text-xs text-blue-700 font-bold">{loc.chamberRoom}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{loc.branchArea || loc.address || 'Dhaka'}</span>
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Fee</span>
                    <span className="font-extrabold text-teal-700">৳{loc.consultationFee || 1200}</span>
                  </div>

                  {/* Configured Shift Slots List for this Chamber */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      Active Slot Times ({chamberShifts.length}):
                    </span>

                    {chamberShifts.length === 0 ? (
                      <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-800">
                        No slot times added yet. Click <strong>+ Add Slot Time</strong> below.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {chamberShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs group"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-800">{shift.dayName}</span>
                                <span className="text-[11px] font-black text-blue-700">
                                  {shift.startTime} — {shift.endTime}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                {shift.slotDurationMinutes}m slot · {shift.bufferMinutes}m buffer
                              </p>
                            </div>

                            <button
                              onClick={() => handleDeleteShift(shift.id, `${shift.dayName} ${shift.startTime}-${shift.endTime}`)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition"
                              title="Delete this slot time"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenAddShiftModal(loc)}
                    className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'স্লট সময় যোগ করুন' : 'Add Slot Time'}</span>
                  </button>

                  <button
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: BATCH SLOT GENERATOR (HORIZON PUBLISHER) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-block mb-1">
              Batch Calendar Publisher
            </span>
            <h2 className="text-lg font-black text-slate-900">
              {language === 'bn'
                ? `"${selectedChamber?.facilityName || 'Chamber'}" এর জন্য ক্যালেন্ডার স্লট প্রকাশ করুন`
                : `Publish Calendar Range Slots for "${selectedChamber?.facilityName || 'Selected Chamber'}"`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select recurring days and shift times to generate slots across upcoming weeks or month.
            </p>
          </div>
        </div>

        {/* Preset Shift Templates */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            {language === 'bn' ? 'দ্রুত শিফট টেমপ্লেট নির্বাচন করুন (Quick Presets):' : 'Quick Shift Presets:'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {shiftPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(preset)}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left transition cursor-pointer"
              >
                <span className="text-xs font-black text-slate-900 block">{preset.name}</span>
                <span className="text-[11px] font-bold text-blue-700 block mt-0.5">{preset.start} — {preset.end}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{preset.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Day Selector Pills */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            {language === 'bn' ? 'সাপ্তাহিক অনুশীলনের দিনসমূহ (Active Days):' : 'Active Days of Week:'}
          </label>
          <div className="flex flex-wrap gap-2">
            {daysMap.map((d) => {
              const active = selectedDays.includes(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => toggleDay(d.day)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time, Duration, Horizon Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'bn' ? 'শিফট শুরুর সময়' : 'Shift Start Time'}
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'bn' ? 'শিফট শেষের সময়' : 'Shift End Time'}
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'bn' ? 'প্রতি রোগী দেখার সময়' : 'Slot Duration (Mins)'}
            </label>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value={15}>15 Minutes (~4 patients/hr)</option>
              <option value={20}>20 Minutes (~3 patients/hr)</option>
              <option value={30}>30 Minutes (~2 patients/hr)</option>
              <option value={45}>45 Minutes (Detailed OPD)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'bn' ? 'স্লট প্রকাশের সীমা' : 'Generation Horizon'}
            </label>
            <select
              value={rangeHorizon}
              onChange={(e) => setRangeHorizon(e.target.value as any)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value="week">Next 7 Days (Upcoming Week)</option>
              <option value="month">Next 30 Days (Full Month)</option>
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            Target Chamber: <span className="font-bold text-slate-800">{selectedChamber?.facilityName}</span> ({selectedChamber?.chamberRoom})
          </div>

          <button
            onClick={handleBulkGenerate}
            disabled={generating || selectedDays.length === 0}
            className="px-6 py-3 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold transition shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Publishing Slots...' : (language === 'bn' ? 'স্লট প্রকাশ করুন' : 'Generate & Publish Slots')}</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: LIVE CHAMBER TESTER & VERIFIER */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block mb-1">
              Live Patient Slot Tester
            </span>
            <h2 className="text-base font-black text-slate-900">
              {language === 'bn' ? 'রোগী যা দেখতে পাবে — তাৎক্ষণিক স্লট পরীক্ষা' : 'Instant Chamber Slot Preview (Patient View)'}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            />
            <button
              onClick={handleTestSlots}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
              title="Refresh slots"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTestSlots ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
            <span>
              Chamber: <strong className="text-blue-700">{selectedChamber?.facilityName}</strong> · Date: <strong>{testDate}</strong>
            </span>
            <span className="text-[11px] text-slate-500">
              {testSlots.length} slots available
            </span>
          </div>

          {loadingTestSlots ? (
            <div className="text-xs text-slate-400 py-4 text-center">Loading slots...</div>
          ) : testSlots.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center italic">
              No slots scheduled for this chamber on {testDate}. Add slot time above to open availability.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {testSlots.map((slot, idx) => {
                const timeOnly = new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl text-center text-xs font-bold border ${
                      slot.isAvailable
                        ? 'bg-white text-slate-800 border-slate-200 shadow-sm'
                        : 'bg-red-50 text-red-500 border-red-200 line-through'
                    }`}
                  >
                    {timeOnly}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Holiday & Exception Blocker */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Ban className="w-5 h-5 text-red-600" />
          <h2 className="text-base font-black text-slate-900">
            {language === 'bn' ? 'ছুটির দিন বা ছুটি নির্ধারণ (Holiday Blocker)' : 'Holiday & Absence Blocker'}
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          {language === 'bn'
            ? 'নির্দিষ্ট তারিখে কোনো চেম্বারে রোগী দেখা বন্ধ রাখতে ছুটি চিহ্নিত করুন।'
            : 'Mark an emergency off-day or clinic holiday to prevent appointments on that date.'}
        </p>

        <form onSubmit={handleBlockDate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Target Date</label>
            <input
              type="date"
              value={exceptionDate}
              onChange={(e) => setExceptionDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Leave</label>
            <input
              type="text"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={blockingDate}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
            >
              {blockingDate ? 'Blocking...' : (language === 'bn' ? 'ছুটি নিশ্চিত করুন' : 'Lock Clinic Holiday')}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL: ADD SLOT TIME FOR CHAMBER */}
      {showAddShiftModal && targetChamberForShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  Chamber Slot Time
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1 flex items-center space-x-2">
                  <span>➕ Add Slot Time for {targetChamberForShift.facilityName}</span>
                </h3>
                <p className="text-xs text-slate-500">{targetChamberForShift.chamberRoom} · {targetChamberForShift.branchArea}</p>
              </div>
              <button
                onClick={() => setShowAddShiftModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChamberShift} className="space-y-4">
              {/* Quick Presets */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Quick Shift Preset:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {shiftPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyModalPreset(preset)}
                      className="p-2 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-xl text-left transition cursor-pointer"
                    >
                      <span className="text-[11px] font-bold text-slate-800 block truncate">{preset.name}</span>
                      <span className="text-[10px] text-blue-700 font-bold block">{preset.start} - {preset.end}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Active Days for this Slot Time:
                  </label>
                  <button
                    type="button"
                    onClick={() => setModalDays(modalDays.length === 7 ? [] : [6, 0, 1, 2, 3, 4, 5])}
                    className="text-[10px] font-bold text-blue-700 hover:underline"
                  >
                    {modalDays.length === 7 ? 'Clear All' : 'Select All Days'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {daysMap.map((d) => {
                    const active = modalDays.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => toggleModalDay(d.day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-700 text-white shadow-sm ring-1 ring-blue-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start and End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={modalEndTime}
                    onChange={(e) => setModalEndTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Slot Duration & Buffer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Slot Duration (Mins)
                  </label>
                  <select
                    value={modalDuration}
                    onChange={(e) => setModalDuration(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={20}>20 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Buffer Gap (Mins)
                  </label>
                  <select
                    value={modalBuffer}
                    onChange={(e) => setModalBuffer(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value={0}>0 Minutes (Continuous)</option>
                    <option value={5}>5 Minutes (Recommended)</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                  </select>
                </div>
              </div>

              {/* Live Preview of generated slots */}
              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Live Slot Preview:</span>
                  </span>
                  <span>{modalSlotPreview.length} slots / day</span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {modalSlotPreview.map((slotTimeStr, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-2 py-0.5 bg-white text-blue-900 font-bold text-[10px] rounded-md border border-blue-200 shadow-2xs"
                    >
                      {slotTimeStr}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddShiftModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingShift || modalDays.length === 0}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {isSavingShift ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Slot Time</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW HOSPITAL CHAMBER */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-700" />
                <span>{language === 'bn' ? 'নতুন হাসপাতাল / চেম্বার যোগ করুন' : 'Add Hospital Chamber'}</span>
              </h3>
              <button
                onClick={() => setShowAddLocationModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'হাসপাতাল বা ক্লিনিকের নাম (Facility Name)*' : 'Hospital / Facility Name*'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Evercare Hospital / Square Hospital"
                  value={newFacilityName}
                  onChange={(e) => setNewFacilityName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'শাখা / এলাকা (Branch Area)' : 'Branch Area'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bashundhara, Dhaka"
                    value={newBranchArea}
                    onChange={(e) => setNewBranchArea(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'চেম্বার রুম (Room No.)' : 'Chamber Room'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room #305, Level 3"
                    value={newChamberRoom}
                    onChange={(e) => setNewChamberRoom(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'পরামর্শ ফি (Consultation Fee ৳)' : 'Consultation Fee (৳)'}
                </label>
                <input
                  type="number"
                  min="500"
                  step="50"
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingLocation}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
                >
                  {isAddingLocation ? 'Adding...' : 'Save Chamber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
