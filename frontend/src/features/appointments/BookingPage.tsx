import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertTriangle, Shield, User, MapPin, Award, LogIn } from 'lucide-react';
import { Doctor, DoctorChamberLocation } from '../doctors/types';
import { doctorService } from '../doctors/services/doctorService';
import { availabilityService } from '../availability/services/availabilityService';
import { appointmentService } from './services/appointmentService';
import { TimeSlot, DayScheduleSummary, DoctorMultiDayScheduleResponse } from '../availability/types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getDoctorChambers } from '../doctors/utils/chamberUtils';

interface BookingPageProps {
  selectedDoctor?: Doctor | null;
  onBookingComplete: () => void;
  onOpenLogin?: () => void;
}

export const BookingPage: React.FC<BookingPageProps> = ({ selectedDoctor, onBookingComplete, onOpenLogin }) => {
  const { isAuthenticated, user } = useAuth();
  const { t, language } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(selectedDoctor || null);
  const [selectedChamber, setSelectedChamber] = useState<DoctorChamberLocation | null>(null);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [schedule, setSchedule] = useState<DoctorMultiDayScheduleResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayScheduleSummary | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [visitType, setVisitType] = useState<string>('new_consultation');
  
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [bookingInProgress, setBookingInProgress] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedToken, setConfirmedToken] = useState<any | null>(null);

  // Fetch doctors list if not provided
  useEffect(() => {
    doctorService.getDoctors()
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
        setDoctors(items);
        if (!currentDoctor && items.length > 0) {
          setCurrentDoctor(items[0]);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch doctors for booking:', err);
      });
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (selectedDoctor) {
      setCurrentDoctor(selectedDoctor);
    }
  }, [selectedDoctor]);

  // Set selectedChamber default when currentDoctor changes
  useEffect(() => {
    if (currentDoctor) {
      const chambers = getDoctorChambers(currentDoctor);
      if (chambers.length > 0) {
        setSelectedChamber(chambers[0]);
      }
    }
  }, [currentDoctor]);

  const isUuid = (id?: string | null): boolean => {
    if (!id || id === 'default' || id === '') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  };

  // Load dynamic 14-day schedule when doctor or chamber location changes
  useEffect(() => {
    if (currentDoctor) {
      const validLocId = isUuid(selectedChamber?.id) ? selectedChamber?.id : undefined;
      loadDoctorSchedule(currentDoctor.id, validLocId);
    }
  }, [currentDoctor, selectedChamber?.id]);

  const loadDoctorSchedule = async (doctorId: string, locationId?: string) => {
    try {
      setLoadingSlots(true);
      setErrorMessage(null);
      setSelectedSlot(null);
      const validLocId = isUuid(locationId) ? locationId : undefined;
      const res = await availabilityService.getDoctorSchedule(doctorId, 14, undefined, validLocId);
      setSchedule(res);

      // Default selected day: first day with available slots or today
      if (res.days && res.days.length > 0) {
        const firstAvailableDay = res.days.find((d) => d.availableSlotsCount > 0) || res.days[0];
        setSelectedDay(firstAvailableDay);
        setSelectedDate(firstAvailableDay.date);
        setSlots(firstAvailableDay.slots || []);
        
        if (res.nextAvailableSlot) {
          setSelectedSlot(res.nextAvailableSlot);
        }
      }
    } catch (e: any) {
      console.warn('Could not load multi-day schedule, falling back to single date query:', e);
      // Fallback to single date query
      const validLocId = isUuid(locationId) ? locationId : undefined;
      loadSingleDateSlots(doctorId, selectedDate, validLocId);
    } finally {
      setLoadingSlots(false);
    }
  };

  const loadSingleDateSlots = async (doctorId: string, dateStr: string, locationId?: string) => {
    try {
      setLoadingSlots(true);
      setErrorMessage(null);
      setSelectedSlot(null);
      const validLocId = isUuid(locationId) ? locationId : undefined;
      const res = await availabilityService.getSlots(doctorId, dateStr, validLocId);
      setSlots(res.slots || []);
    } catch (e: any) {
      setErrorMessage('Could not load availability slots for this date.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectDay = (day: DayScheduleSummary) => {
    setSelectedDay(day);
    setSelectedDate(day.date);
    setSlots(day.slots || []);
    setSelectedSlot(null);
  };

  const handleBook = async () => {
    if (!currentDoctor || !selectedSlot) return;
    if (!isAuthenticated) {
      setErrorMessage('Authentication required: Please log in to reserve your appointment token.');
      if (onOpenLogin) onOpenLogin();
      return;
    }

    try {
      setBookingInProgress(true);
      setErrorMessage(null);
      const validLocId = isUuid(selectedChamber?.id) ? selectedChamber?.id : undefined;
      const appt = await appointmentService.book({
        doctorId: currentDoctor.id,
        locationId: validLocId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        visitType,
        chiefComplaint: chiefComplaint || 'Routine medical checkup',
      });

      const chamberFacility = selectedChamber?.facilityName || currentDoctor.facilityName || 'Popular Diagnostic Centre';
      const chamberRoom = selectedChamber?.chamberRoom || currentDoctor.chamberRoom || 'Room #405, Level 4';
      const chamberBranch = selectedChamber?.branchArea || 'Dhanmondi Branch';
      const chamberFee = selectedChamber?.consultationFee || currentDoctor.consultationFee || 1200;

      // Synchronize to localStorage so LiveQueueTracker instantly recognizes this doctor & chamber
      try {
        const stored = JSON.parse(localStorage.getItem('my_booked_serials') || '[]');
        const updated = [
          {
            ...appt,
            doctorName: currentDoctor.name,
            doctorSpecialization: currentDoctor.specialization,
            facilityName: chamberFacility,
            chamberRoom: chamberRoom,
            branchArea: chamberBranch,
            fee: chamberFee,
          },
          ...stored.filter((x: any) => x.id !== appt.id),
        ];
        localStorage.setItem('my_booked_serials', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }

      setConfirmedToken({
        ...appt,
        doctorName: currentDoctor.name,
        facilityName: chamberFacility,
        chamberRoom: chamberRoom,
        branchArea: chamberBranch,
        fee: chamberFee,
      });
      onBookingComplete();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMessage('⚠️ This slot has just been reserved by another patient. Please choose another slot.');
        loadDoctorSchedule(currentDoctor.id, selectedChamber?.id);
      } else {
        setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to book appointment');
      }
    } finally {
      setBookingInProgress(false);
    }
  };

  if (confirmedToken) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-3xl p-8 border border-teal-200 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto text-teal-700">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {t('book.confirmed_badge', 'Token Confirmed')}
            </span>
            <h2 className="text-4xl font-extrabold text-slate-900 mt-3">
              {t('book.confirmed_title', 'Serial #')}{confirmedToken.tokenNumber}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {t('book.confirmed_msg', 'Your reservation is confirmed with')} <span className="font-semibold text-teal-800">{confirmedToken.doctorName}</span>
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-700 border border-slate-200 divide-y divide-slate-100">
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400">{language === 'bn' ? 'রোগীর নাম (Patient):' : 'Patient Name:'}</span>
              <span className="font-extrabold text-slate-900">{user?.name || 'Registered Patient'}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-400">{t('book.confirmed_doctor', 'Doctor:')}</span>
              <div className="text-right">
                <span className="font-extrabold text-slate-900 block">{confirmedToken.doctorName}</span>
                <span className="text-[10px] text-teal-700 font-bold">{currentDoctor?.specialization}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-400">{language === 'bn' ? 'হাসপাতাল ও চেম্বার:' : 'Hospital / Chamber:'}</span>
              <div className="text-right">
                <span className="font-extrabold text-blue-700 block">{confirmedToken.facilityName}</span>
                <span className="text-[10px] text-slate-600 font-semibold">{confirmedToken.chamberRoom}{confirmedToken.branchArea ? ` • ${confirmedToken.branchArea}` : ''}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-400">{language === 'bn' ? 'সিরিয়াল নম্বর (Serial No):' : 'Serial No:'}</span>
              <span className="font-black text-slate-900 bg-slate-200/70 px-2 py-0.5 rounded-lg text-sm">#{confirmedToken.tokenNumber}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-400">{t('book.confirmed_schedule', 'Scheduled Date & Time:')}</span>
              <span className="font-extrabold text-slate-800">
                {new Date(confirmedToken.startTime).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-400">{language === 'bn' ? 'সিরিয়াল নেওয়ার সময় (Booked On):' : 'Booked On:'}</span>
              <span className="font-semibold text-slate-700 text-[11px]">
                {confirmedToken.createdAt
                  ? new Date(confirmedToken.createdAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
                  : new Date().toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-400">{t('book.confirmed_payment', 'Payment:')}</span>
              <span className="font-bold text-teal-700 uppercase">{t('book.confirmed_pay_at_chamber', 'Pay At Chamber')} (৳{confirmedToken.fee})</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {t('book.confirmed_guideline', 'No advance charge required. Please report to the reception desk 15 minutes prior to your serial call.')}
          </p>

          <button
            onClick={() => setConfirmedToken(null)}
            className="w-full py-3 bg-teal-700 hover:bg-teal-600 text-white rounded-xl font-bold text-sm transition shadow-md cursor-pointer"
          >
            {t('book.confirmed_another_btn', 'Book Another Visit')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">{t('book.title', 'Reserve Chamber Appointment')}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('book.subtitle', 'Instant token assignment · Zero advance payment required')}</p>

        {/* Selected Doctor Summary Card */}
        {currentDoctor && (
          <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              {currentDoctor.profilePhotoUrl ? (
                <img
                  src={currentDoctor.profilePhotoUrl}
                  alt={currentDoctor.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white font-bold flex items-center justify-center text-lg">
                  {currentDoctor.name[0]}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-slate-900">{currentDoctor.name}</h3>
                  <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {currentDoctor.bmdcNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{currentDoctor.degrees} · {currentDoctor.specialization}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                  {selectedChamber?.branchArea || currentDoctor.facility || 'Dhanmondi Branch'}
                </p>
              </div>
            </div>
            <div className="text-right sm:text-right shrink-0">
              <span className="text-[11px] text-slate-400 block font-semibold">{t('doctors.fee', 'Consultation Fee')}</span>
              <span className="text-lg font-black text-teal-700">৳{selectedChamber?.consultationFee || currentDoctor.consultationFee}</span>
            </div>
          </div>
        )}

        {/* Multi-Chamber Practice Location Selector */}
        {currentDoctor && (
          <div className="mt-6 space-y-2">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              {language === 'bn' ? '📍 চেম্বার ও হাসপাতালের স্থান নির্বাচন করুন (Chamber Location):' : '📍 Select Chamber Location:'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {getDoctorChambers(currentDoctor).map((ch) => {
                const isSelected = selectedChamber?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChamber(ch)}
                    className={`p-3.5 rounded-2xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-600/30 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs text-slate-900 line-clamp-1">{(ch.branchArea || ch.facilityName || 'Chamber').split(' ')[0]}</span>
                        {isSelected && <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">✓</span>}
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium line-clamp-1">{ch.facilityName}</p>
                      <p className="text-[10px] text-blue-700 font-bold mt-1">{ch.chamberRoom}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 text-[10px]">{(ch.scheduleDays || 'Weekly').split(' ')[0]}</span>
                      <span className="font-extrabold text-teal-700">৳{ch.consultationFee}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            {!isAuthenticated && onOpenLogin && (
              <button
                onClick={onOpenLogin}
                className="ml-3 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 flex items-center space-x-1 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>
            )}
          </div>
        )}

        {/* Doctor Chamber Sitting Schedule Card */}
        {schedule && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm border border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  {language === 'bn' ? '🗓️ ডাক্তার চেম্বারে বসার শিডিউল (Practice Schedule):' : '🗓️ Doctor Chamber Schedule:'}
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {language === 'bn' && schedule.sittingDaysBn?.length
                    ? schedule.sittingDaysBn.join(', ')
                    : schedule.sittingDays?.join(', ')}{' '}
                  · <span className="text-teal-400 font-extrabold">{schedule.sittingHours}</span>
                </div>
                <div className="text-[11px] text-teal-300/90 font-medium mt-0.5">
                  📍 {selectedChamber?.facilityName || schedule.facilityName}{' '}
                  {(selectedChamber?.chamberRoom || schedule.chamberRoom) ? `· ${selectedChamber?.chamberRoom || schedule.chamberRoom}` : ''}
                  {selectedChamber?.branchArea ? ` (${selectedChamber.branchArea})` : ''}
                </div>
              </div>
            </div>

            {schedule.nextAvailableSlot && (
              <button
                type="button"
                onClick={() => {
                  if (schedule.nextAvailableDate && schedule.days) {
                    const dayObj = schedule.days.find((d) => d.date === schedule.nextAvailableDate);
                    if (dayObj) {
                      handleSelectDay(dayObj);
                      setSelectedSlot(schedule.nextAvailableSlot || null);
                    }
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500/20 to-blue-500/20 border border-teal-500/50 text-teal-300 text-xs font-bold hover:bg-teal-500/30 transition flex items-center space-x-1.5 cursor-pointer shrink-0"
              >
                <span>⚡ {language === 'bn' ? 'দ্রুততম ফাঁকা স্লট' : 'Earliest Free Slot'}:</span>
                <span className="underline text-white font-extrabold">
                  {new Date(schedule.nextAvailableSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Doctor Selector */}
        <div className="mt-6">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            {t('book.select_specialist', 'Specialist Doctor:')}
          </label>
          <select
            value={currentDoctor?.id || ''}
            onChange={(e) => {
              const found = doctors.find((d) => d.id === e.target.value);
              setCurrentDoctor(found || null);
            }}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialization} ({d.facility || 'Popular Centre'})
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic 14-Day Upcoming Calendar Selector */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800">
                {language === 'bn' ? '📅 দিন ও তারিখ নির্বাচন করুন (Select Appointment Day):' : '📅 Select Appointment Day:'}
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'bn'
                  ? 'পরবর্তী ১৪ দিনের চেম্বার ও ফাঁকা স্লট স্বয়ংক্রিয়ভাবে আপডেট হচ্ছে'
                  : 'Live 14-day rolling schedule with real-time chamber slot counts'}
              </p>
            </div>
            {selectedDay && (
              <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                {language === 'bn' ? selectedDay.dayNameBn : selectedDay.dayName} · {selectedDay.formattedDate}
              </span>
            )}
          </div>

          {/* Days Pills Scroll Bar */}
          {schedule?.days && schedule.days.length > 0 ? (
            <div className="flex space-x-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {schedule.days.map((d) => {
                const isSelected = selectedDate === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => handleSelectDay(d)}
                    className={`shrink-0 p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-between min-w-[100px] ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/90 ring-2 ring-teal-600/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      {d.isToday ? (language === 'bn' ? 'আজ' : 'Today') : (language === 'bn' ? d.dayNameBn.slice(0, 3) : d.dayName.slice(0, 3))}
                    </span>
                    <span className="text-sm font-black text-slate-900 my-0.5">{d.formattedDate}</span>
                    
                    {/* Status Badge */}
                    {d.availableSlotsCount > 0 ? (
                      <span className="text-[10px] font-extrabold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full border border-teal-200">
                        {d.availableSlotsCount} {language === 'bn' ? 'ফাঁকা' : 'open'}
                      </span>
                    ) : d.hasShift ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        {language === 'bn' ? 'পূর্ণ' : 'Full'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {language === 'bn' ? 'বন্ধ' : 'Off'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (currentDoctor) loadSingleDateSlots(currentDoctor.id, e.target.value, selectedChamber?.id);
                }}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
              />
            </div>
          )}
        </div>

        {/* Time Slots Section */}
        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800">
                {t('book.available_slots', 'Available Time Slots:')}
              </label>
              <span className="text-[11px] text-slate-400">
                {selectedDay?.chamberTiming ? `Chamber Hours: ${selectedDay.chamberTiming}` : ''}
              </span>
            </div>
            {slots.length > 0 && (
              <span className="text-xs text-teal-800 font-bold bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                {slots.filter((s) => s.isAvailable).length} {t('book.slots_open', 'slots free to book')}
              </span>
            )}
          </div>

          {loadingSlots ? (
            <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
              <div className="w-7 h-7 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 text-xs font-medium">
                {language === 'bn' ? 'ডাক্তারের ফাঁকা স্লট লোড করা হচ্ছে...' : 'Loading doctor schedule & real-time slots...'}
              </p>
            </div>
          ) : slots.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
              <Calendar className="w-9 h-9 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">
                {selectedDay && !selectedDay.hasShift
                  ? (language === 'bn' ? 'এই তারিখে ডাক্তারের চেম্বার বন্ধ রয়েছে' : 'Doctor does not practice on this day')
                  : t('book.no_slots', 'No slots scheduled for this date')}
              </p>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                {language === 'bn'
                  ? 'দয়া করে উপরের ক্যালেন্ডার থেকে অন্য কোন দিন নির্বাচন করুন।'
                  : 'Please pick another date from the upcoming calendar bar above.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {slots.map((s, idx) => {
                const isSelected = selectedSlot?.startTime === s.startTime;
                const timeLabel = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!s.isAvailable}
                    onClick={() => setSelectedSlot(s)}
                    className={`p-3.5 rounded-2xl text-left transition relative cursor-pointer border flex flex-col justify-between ${
                      !s.isAvailable
                        ? s.isPast
                          ? 'bg-slate-100/60 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-red-50/50 border-red-200/80 text-red-400 cursor-not-allowed'
                        : isSelected
                        ? 'bg-teal-700 text-white border-teal-700 shadow-md ring-2 ring-teal-700 ring-offset-2'
                        : 'bg-white hover:bg-teal-50/60 border-slate-200 hover:border-teal-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-black text-sm">{timeLabel}</span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-white text-teal-700 text-[10px] flex items-center justify-center font-black">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-current/10 flex items-center justify-between text-[11px]">
                      <span className="opacity-80">30 min</span>
                      {!s.isAvailable ? (
                        <span className="font-bold uppercase text-[10px]">
                          {s.isPast ? (language === 'bn' ? 'সময় পার' : 'Passed') : (language === 'bn' ? 'বুক করা' : 'Booked')}
                        </span>
                      ) : (
                        <span className="font-bold text-[10px] uppercase text-teal-600 group-hover:text-teal-700">
                          {isSelected ? (language === 'bn' ? 'নির্বাচিত' : 'Selected') : (language === 'bn' ? 'ফাঁকা' : 'Available')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Symptoms & Visit Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">{t('book.visit_type', 'Visit Type')}</label>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="new_consultation">{t('book.type_new', 'New Consultation')}</option>
              <option value="followup">{t('book.type_followup', 'Follow-up Visit')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">{t('book.chief_complaint', 'Chief Complaint / Symptoms')}</label>
            <input
              type="text"
              placeholder={t('book.chief_placeholder', 'e.g. Chest discomfort, hypertension check...')}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block font-medium">{t('book.fee_notice', 'Estimated Fee (Pay at Chamber)')}</span>
            <span className="text-xl font-extrabold text-slate-900">
              ৳{currentDoctor?.consultationFee || 1200}
            </span>
            <p className="text-[11px] text-teal-700 mt-0.5">{t('book.zero_advance', 'Zero advance online payment required. Pay at doctor chamber.')}</p>
          </div>
          <button
            disabled={!selectedSlot || bookingInProgress}
            onClick={handleBook}
            className={`px-8 py-3 rounded-xl text-sm font-bold text-white transition cursor-pointer ${
              !selectedSlot || bookingInProgress
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-teal-700 hover:bg-teal-600 shadow-md'
            }`}
          >
            {bookingInProgress ? t('book.processing', 'Reserving...') : t('book.confirm_btn', 'Confirm Reservation')}
          </button>
        </div>
      </div>
    </div>
  );
};
