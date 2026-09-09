import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertTriangle, Shield, User, MapPin, Award, LogIn } from 'lucide-react';
import { Doctor, DoctorChamberLocation } from '../doctors/types';
import { doctorService } from '../doctors/services/doctorService';
import { availabilityService } from '../availability/services/availabilityService';
import { appointmentService } from './services/appointmentService';
import { TimeSlot } from '../availability/types';
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

  // Load slots when doctor, date, or chamber location changes
  useEffect(() => {
    if (currentDoctor && selectedDate) {
      loadSlots(currentDoctor.id, selectedDate, selectedChamber?.id);
    }
  }, [currentDoctor, selectedDate, selectedChamber?.id]);

  const loadSlots = async (doctorId: string, dateStr: string, locationId?: string) => {
    try {
      setLoadingSlots(true);
      setErrorMessage(null);
      setSelectedSlot(null);
      const res = await availabilityService.getSlots(doctorId, dateStr, locationId);
      setSlots(res.slots || []);
    } catch (e: any) {
      setErrorMessage('Could not load availability slots for this date.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
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
      const appt = await appointmentService.book({
        doctorId: currentDoctor.id,
        locationId: selectedChamber?.id,
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
        loadSlots(currentDoctor.id, selectedDate);
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

          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-600 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('book.confirmed_doctor', 'Doctor:')}</span>
              <span className="font-semibold text-slate-800">{confirmedToken.doctorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'bn' ? 'চেম্বার ও শাখা:' : 'Chamber Location:'}</span>
              <span className="font-extrabold text-blue-700">{confirmedToken.facilityName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'bn' ? 'চেম্বার রুম:' : 'Chamber Room:'}</span>
              <span className="font-semibold text-slate-800">{confirmedToken.chamberRoom}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('book.confirmed_schedule', 'Schedule:')}</span>
              <span className="font-semibold text-slate-800">
                {new Date(confirmedToken.startTime).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="flex justify-between">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Doctor Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">{t('book.select_specialist', 'Change Specialist')}</label>
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
                  {d.name} — {d.specialization}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">{t('book.select_date', 'Select Calendar Date')}</label>
            <input
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            />
          </div>
        </div>

        {/* Available Time Slots */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-semibold text-slate-700">
              {t('book.available_slots', 'Available Time Slots on')} {selectedDate}
            </label>
            {slots.length > 0 && (
              <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {slots.filter((s) => s.isAvailable).length} {t('book.slots_open', 'slots open')}
              </span>
            )}
          </div>

          {loadingSlots ? (
            <div className="py-10 text-center bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 text-xs font-medium">Loading live slots from schedule engine...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-1">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="font-semibold text-slate-700">{t('book.no_slots', 'No slots scheduled for this date')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {slots.map((s, idx) => {
                const isSelected = selectedSlot?.startTime === s.startTime;
                const timeLabel = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!s.isAvailable}
                    onClick={() => setSelectedSlot(s)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition text-center cursor-pointer ${
                      !s.isAvailable
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200 line-through'
                        : isSelected
                        ? 'bg-teal-700 text-white shadow-md ring-2 ring-teal-700 ring-offset-1'
                        : 'bg-teal-50/80 text-teal-900 hover:bg-teal-100 border border-teal-200/80'
                    }`}
                  >
                    {timeLabel}
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
