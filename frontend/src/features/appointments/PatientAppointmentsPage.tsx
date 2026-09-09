import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Ticket,
  AlertCircle,
  Ban,
  QrCode,
  Printer,
  X,
  MapPin,
  CheckCircle,
  Activity,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Phone,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { appointmentService } from './services/appointmentService';
import { Appointment, DoctorQueueResponse } from './types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface PatientAppointmentsPageProps {
  onOpenLogin?: () => void;
  onNavigateToDoctors?: () => void;
}

export const PatientAppointmentsPage: React.FC<PatientAppointmentsPageProps> = ({
  onOpenLogin,
  onNavigateToDoctors,
}) => {
  const { isAuthenticated, user } = useAuth();
  const { language, t } = useLanguage();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPass, setSelectedPass] = useState<Appointment | null>(null);
  const [doctorQueueMap, setDoctorQueueMap] = useState<Record<string, DoctorQueueResponse>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModalAppt, setCancelModalAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Schedule clash / Emergency');

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchAppointments = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentService.getMyAppointments(filter);
      setAppointments(data);

      // For upcoming appointments, fetch live queue for each doctor
      if (filter === 'upcoming' && data.length > 0) {
        const uniqueDoctorIds = Array.from(new Set(data.map((a) => a.doctorId)));
        uniqueDoctorIds.forEach(async (docId) => {
          try {
            const q = await appointmentService.getDoctorQueue(docId, todayStr);
            setDoctorQueueMap((prev) => ({ ...prev, [docId]: q }));
          } catch (e) {
            // silent catch
          }
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to retrieve appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filter, isAuthenticated]);

  const handleCancelSubmit = async () => {
    if (!cancelModalAppt) return;
    try {
      setCancellingId(cancelModalAppt.id);
      await appointmentService.cancel(cancelModalAppt.id, cancelReason);
      setCancelModalAppt(null);
      await fetchAppointments();
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to cancel appointment.');
    } finally {
      setCancellingId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-4">
          <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-100">
            <Ticket className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            {language === 'bn' ? 'লগইন প্রয়োজন' : 'Authentication Required'}
          </h3>
          <p className="text-xs text-slate-500">
            {language === 'bn'
              ? 'আপনার বুক করা সিরিয়াল ও অফিশিয়াল চেম্বার স্লিপ দেখতে অনুগ্রহ করে লগইন করুন।'
              : 'Please log in with your patient account to view your active serials and official chamber slips.'}
          </p>

          {onOpenLogin && (
            <button
              onClick={onOpenLogin}
              className="w-full py-3 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              {language === 'bn' ? 'লগইন করুন' : 'Log In to My Account'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              {language === 'bn' ? 'আমার সিরিয়াল ও চেম্বার স্লিপ' : 'My Serials & Chamber Slips'}
            </h1>
            <span className="bg-teal-50 text-teal-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-teal-200">
              {appointments.length} {language === 'bn' ? 'টি অ্যাপয়েন্টমেন্ট' : 'Appointments'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'bn'
              ? 'আপনার বুককৃত ডাক্তার চেম্বারের লাইভ সিরিয়াল অগ্রগতি ও প্রবেশ পাস'
              : 'Live tracking of your doctor chamber queue progress and digital passes'}
          </p>
        </div>

        {/* Filter Toggle Pills */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto border border-slate-200">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'upcoming'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'আসন্ন সিরিয়াল (Upcoming)' : 'Upcoming'}
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'past'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'পূর্ববর্তী ইতিহাস (Past)' : 'Past History'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-600">
            {language === 'bn' ? 'আপনার সিরিয়াল তথ্য লোড হচ্ছে...' : 'Loading your appointments...'}
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center max-w-md mx-auto">
          <p className="text-xs font-bold text-red-700">{error}</p>
          <button
            onClick={fetchAppointments}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition"
          >
            {language === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Retry'}
          </button>
        </div>
      ) : appointments.length === 0 ? (
        /* Dynamic Empty State */
        <div className="bg-white rounded-3xl p-12 sm:p-16 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Ticket className="w-8 h-8 text-slate-400" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base sm:text-lg font-black text-slate-800">
              {language === 'bn' ? 'আপনার কোনো সক্রিয় সিরিয়াল বা স্লিপ নেই' : `No ${filter} appointments found`}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'বিশেষজ্ঞ ডাক্তারের সিরিয়াল নিতে ডাক্তার তালিকা থেকে আপনার পছন্দমত সময় বুকিং করুন।'
                : 'You have not reserved any appointments in this category. Book your visit from the specialist directory.'}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                if (onNavigateToDoctors) onNavigateToDoctors();
                else window.location.hash = 'doctors';
              }}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-extrabold transition shadow-md inline-flex items-center space-x-2 cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              <span>{language === 'bn' ? 'ডাক্তার খুঁজুন ও সিরিয়াল নিন' : 'Find Doctor & Book Serial'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Appointment Cards List */
        <div className="space-y-4">
          {appointments.map((appt) => {
            const queueInfo = doctorQueueMap[appt.doctorId];
            const runningSerial = queueInfo?.currentRunningSerial;
            const isMyTurn = runningSerial === appt.tokenNumber;
            const isAhead = runningSerial && appt.tokenNumber > runningSerial;
            const waitPatients = isAhead ? appt.tokenNumber - runningSerial : 0;

            return (
              <div
                key={appt.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-start space-x-4">
                  {/* Big Serial Token Badge */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-700 to-slate-900 text-white flex flex-col items-center justify-center shrink-0 shadow-md border border-teal-500/30">
                    <span className="text-[9px] uppercase font-black text-teal-300 tracking-wider">SERIAL</span>
                    <span className="text-2xl font-black">#{appt.tokenNumber}</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black text-slate-900">{appt.doctorName}</h3>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {appt.status}
                      </span>
                    </div>

                    <p className="text-xs text-teal-700 font-bold">{appt.specialization}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      <span className="flex items-center space-x-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(appt.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </span>

                      <span className="flex items-center space-x-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>

                      <span className="bg-amber-50 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-amber-200 uppercase">
                        ৳{appt.fee} · {appt.paymentStatus === 'pay_at_chamber' ? (language === 'bn' ? 'চেম্বারে প্রদেয়' : 'Pay at Chamber') : appt.paymentStatus}
                      </span>
                    </div>

                    {/* Live Queue Tracker Status for this appointment */}
                    {filter === 'upcoming' && appt.status !== 'cancelled' && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center space-x-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
                        <span className="text-slate-600 font-medium">
                          {isMyTurn ? (
                            <span className="font-extrabold text-emerald-700">
                              {language === 'bn' ? '🎉 আপনার সিরিয়াল চলছে! সরাসরি চেম্বারে প্রবেশ করুন।' : '🎉 Your serial is active! Please enter the chamber.'}
                            </span>
                          ) : isAhead ? (
                            <span>
                              {language === 'bn'
                                ? `চেম্বারে চলমান সিরিয়াল: #${runningSerial} · আপনার আগে অপেক্ষমাণ: ${waitPatients} জন (আনুমানিক অপেক্ষা: ${waitPatients * 12} মিনিট)`
                                : `Running serial: #${runningSerial} · Patients ahead: ${waitPatients} (~${waitPatients * 12} mins wait)`}
                            </span>
                          ) : (
                            <span>
                              {language === 'bn'
                                ? `চেম্বারে চলমান সিরিয়াল: #${runningSerial || 'শুরু হয়নি'}`
                                : `Chamber running serial: #${runningSerial || 'Not started'}`}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions: View Slip & Cancel */}
                <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => setSelectedPass(appt)}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition shadow flex items-center space-x-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'চেম্বার স্লিপ ও কিউআর' : 'Chamber Slip & QR'}</span>
                  </button>

                  {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                    <button
                      onClick={() => setCancelModalAppt(appt)}
                      className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'বাতিল' : 'Cancel'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Official Chamber Pass / QR Slip Modal */}
      {selectedPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setSelectedPass(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 inline-block mb-3">
                {language === 'bn' ? 'অফিসিয়াল চেম্বার অ্যাপয়েন্টমেন্ট স্লিপ' : 'Official Chamber Slip'}
              </span>

              {/* Big Token Number Display */}
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-slate-900 to-teal-900 text-white flex flex-col items-center justify-center mx-auto shadow-xl my-2 border-2 border-teal-400/30">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">SERIAL</span>
                <span className="text-4xl font-black">#{selectedPass.tokenNumber}</span>
              </div>

              <h3 className="text-lg font-black text-slate-900 mt-2">{selectedPass.doctorName}</h3>
              <p className="text-xs text-teal-700 font-bold">{selectedPass.specialization}</p>

              {/* QR Code Pass */}
              <div className="my-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
                <div className="w-32 h-32 bg-white p-2 rounded-xl flex items-center justify-center border border-slate-200 mx-auto">
                  <div className="w-full h-full border-2 border-dashed border-slate-800 rounded flex flex-col items-center justify-center text-center p-1">
                    <QrCode className="w-14 h-14 text-slate-900" />
                    <span className="text-[9px] font-mono font-bold text-slate-700 mt-1">TOKEN-{selectedPass.tokenNumber}</span>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-black text-slate-400 block mt-1 tracking-wider">
                  SCAN AT CLINIC RECEPTION
                </span>
              </div>

              {/* Slip Summary Info */}
              <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-100 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Patient Name:</span>
                  <span className="font-bold text-slate-900">{user?.name || 'Registered Patient'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Scheduled Date:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedPass.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time Slot:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedPass.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Consultation Fee:</span>
                  <span className="font-extrabold text-teal-700">৳{selectedPass.fee || 1000}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="font-black text-amber-700 uppercase text-[10px]">PAY AT CHAMBER</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{language === 'bn' ? 'প্রিন্ট স্লিপ' : 'Print Slip'}</span>
                </button>
                <button
                  onClick={() => setSelectedPass(null)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">
                {language === 'bn' ? 'সিরিয়াল বাতিল নিশ্চিতকরণ' : 'Cancel Appointment'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'bn'
                  ? `আপনি কি নিশ্চিত যে ডাঃ ${cancelModalAppt.doctorName} এর সিরিয়াল #${cancelModalAppt.tokenNumber} বাতিল করতে চান?`
                  : `Are you sure you want to cancel serial #${cancelModalAppt.tokenNumber} with Dr. ${cancelModalAppt.doctorName}?`}
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {language === 'bn' ? 'বাতিলের কারণ' : 'Cancellation Reason'}
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-red-500"
              >
                <option value="Schedule clash / Emergency">Schedule clash / Emergency</option>
                <option value="Patient feeling better">Patient feeling better</option>
                <option value="Booking error / Wrong date">Booking error / Wrong date</option>
                <option value="Doctor unavailable">Doctor unavailable</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setCancelModalAppt(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {language === 'bn' ? 'না, ফেরত যান' : 'No, Keep It'}
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={cancellingId !== null}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
              >
                {cancellingId ? 'Cancelling...' : (language === 'bn' ? 'হ্যাঁ, বাতিল করুন' : 'Yes, Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
