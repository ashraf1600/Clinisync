import React from 'react';
import {
  QrCode,
  Printer,
  X,
  MapPin,
  CheckCircle,
  Ticket,
  Calendar,
  Clock,
  User,
  Stethoscope,
} from 'lucide-react';
import { Appointment } from '../features/appointments/types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface ChamberPassModalProps {
  appt: Appointment;
  onClose: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-slate-200 text-slate-700 border-slate-300',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  no_show: 'bg-orange-100 text-orange-800 border-orange-200',
};

const paymentLabel = (status: string | undefined, bn: boolean): string => {
  if (status === 'paid') return bn ? 'পরিশোধিত' : 'PAID';
  if (status === 'waived') return bn ? 'মওকুফ' : 'WAIVED';
  return bn ? 'চেম্বারে নগদ প্রদান' : 'PAY AT CHAMBER';
};

/**
 * Official Chamber Pass — single shared slip used by My Appointments and the
 * Live Tracker. Every field maps 1:1 to backend `AppointmentRead`:
 * token_number, patient_name, doctor_name/specialization, facility/chamber/branch,
 * status, start/end time, chief_complaint, created_at, fee, payment_status, id.
 */
export const ChamberPassModal: React.FC<ChamberPassModalProps> = ({ appt, onClose }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const bn = language === 'bn';

  const start = new Date(appt.startTime);
  const end = new Date(appt.endTime);
  const dateFmt = new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  });
  const bookedFmt = new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });
  const slotRange = !isNaN(start.getTime()) && !isNaN(end.getTime())
    ? `${timeFmt.format(start)} – ${timeFmt.format(end)}`
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      {/* Full-view: capped height with internal scroll so the whole slip is reachable */}
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 inline-block mb-3">
            {bn ? 'অফিসিয়াল চেম্বার অ্যাপয়েন্টমেন্ট স্লিপ' : 'Official Chamber Slip'}
          </span>

          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-slate-900 to-teal-900 text-white flex flex-col items-center justify-center mx-auto shadow-xl my-2 border-2 border-teal-400/30">
            <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">SERIAL</span>
            <span className="text-4xl font-black">#{appt.tokenNumber}</span>
          </div>

          <span className={`inline-block mt-2 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${STATUS_STYLE[appt.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {appt.status.replace('_', ' ')}
          </span>

          <h3 className="text-lg font-black text-slate-900 mt-2">{appt.doctorName}</h3>
          <p className="text-xs text-teal-700 font-bold">{appt.specialization}</p>

          <div className="my-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
            <div className="w-32 h-32 bg-white p-2 rounded-xl flex items-center justify-center border border-slate-200 mx-auto">
              <div className="w-full h-full border-2 border-dashed border-slate-800 rounded flex flex-col items-center justify-center text-center p-1">
                <QrCode className="w-14 h-14 text-slate-900" />
                <span className="text-[9px] font-mono font-bold text-slate-700 mt-1">TOKEN-{appt.tokenNumber}</span>
              </div>
            </div>
            <span className="text-[9px] uppercase font-black text-slate-400 block mt-1 tracking-wider">
              SCAN AT CLINIC RECEPTION
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5 border border-slate-200/80 text-xs mb-5 divide-y divide-slate-100">
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" /> {bn ? 'রোগীর নাম (Patient):' : 'Patient Name:'}
              </span>
              <span className="font-extrabold text-slate-900">{appt.patientName || user?.name || 'Registered Patient'}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Stethoscope className="w-3.5 h-3.5 text-slate-400" /> {bn ? 'চিকিৎসক (Doctor):' : 'Doctor Name:'}
              </span>
              <div className="text-right">
                <span className="font-extrabold text-slate-900 block">{appt.doctorName}</span>
                <span className="text-[10px] text-teal-700 font-bold">{appt.specialization}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {bn ? 'হাসপাতাল ও চেম্বার:' : 'Hospital / Chamber:'}
              </span>
              <div className="text-right">
                <span className="font-extrabold text-blue-700 block">{appt.facilityName || 'Popular Diagnostic Centre'}</span>
                <span className="text-[10px] text-slate-600 font-semibold">{appt.chamberRoom || 'Room #402, Level 4'}{appt.branchArea ? ` • ${appt.branchArea}` : ''}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Ticket className="w-3.5 h-3.5 text-slate-400" /> {bn ? 'সিরিয়াল নম্বর (Serial No):' : 'Serial No:'}
              </span>
              <span className="font-black text-slate-900 text-sm bg-slate-200/70 px-2 py-0.5 rounded-lg">#{appt.tokenNumber}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {bn ? 'অ্যাপয়েন্টমেন্টের তারিখ:' : 'Scheduled Date:'}
              </span>
              <span className="font-extrabold text-slate-800">
                {!isNaN(start.getTime()) ? dateFmt.format(start) : '—'}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {bn ? 'নির্ধারিত সময় (Slot Time):' : 'Slot Time:'}
              </span>
              <span className="font-extrabold text-slate-800">{slotRange}</span>
            </div>

            {appt.chiefComplaint && (
              <div className="flex justify-between items-start gap-3 pt-2">
                <span className="text-slate-500 font-medium shrink-0">{bn ? 'সমস্যা (Reason):' : 'Reason:'}</span>
                <span className="font-semibold text-slate-700 text-right">{appt.chiefComplaint}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {bn ? 'সিরিয়াল নেওয়ার সময় (Booked On):' : 'Booked On:'}
              </span>
              <span className="font-semibold text-slate-700 text-[11px]">
                {appt.createdAt && !isNaN(new Date(appt.createdAt).getTime())
                  ? bookedFmt.format(new Date(appt.createdAt))
                  : 'Recently Booked'}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 font-medium">{bn ? 'ভিজিট ফি (Consultation Fee):' : 'Consultation Fee:'}</span>
              <span className="font-black text-teal-700 text-sm">৳{appt.fee || 1000}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 font-medium">{bn ? 'পেমেন্ট মাধ্যম (Payment Mode):' : 'Payment Mode:'}</span>
              <span className="font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
                {paymentLabel(appt.paymentStatus, bn)}
              </span>
            </div>

            {appt.id && (
              <div className="flex justify-between items-center pt-2 text-[10px] text-slate-400 font-mono">
                <span>Tracking Ref:</span>
                <span>{appt.id.slice(0, 13).toUpperCase()}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{bn ? 'প্রিন্ট স্লিপ' : 'Print Slip'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {bn ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
