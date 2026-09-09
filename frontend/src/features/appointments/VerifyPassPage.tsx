import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldX, Ticket, Calendar, Clock, User, Stethoscope, MapPin, Wallet, RefreshCw } from 'lucide-react';
import { appointmentService, VerifyPassResult } from './services/appointmentService';
import { useLanguage } from '../../context/LanguageContext';

interface VerifyPassPageProps {
  appointmentId: string;
}

/** Reception check-in: staff scans the chamber-pass QR and lands here. */
export const VerifyPassPage: React.FC<VerifyPassPageProps> = ({ appointmentId }) => {
  const { language } = useLanguage();
  const bn = language === 'bn';
  const [result, setResult] = useState<VerifyPassResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentService.verifyPass(appointmentId);
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [appointmentId]);

  const timeFmt = new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
          {bn ? 'রিসেপশন চেক-ইন যাচাই' : 'Reception Check-In Verify'}
        </span>

        {loading ? (
          <div className="py-10">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-600">{bn ? 'স্লিপ যাচাই হচ্ছে...' : 'Verifying slip...'}</p>
          </div>
        ) : error ? (
          <div className="py-6 space-y-3">
            <ShieldX className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button onClick={load} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer">
              {bn ? 'পুনরায় চেষ্টা' : 'Retry'}
            </button>
          </div>
        ) : result ? (
          <>
            <div className={`rounded-3xl p-5 ${result.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              {result.valid ? (
                <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto" />
              ) : (
                <ShieldX className="w-12 h-12 text-red-500 mx-auto" />
              )}
              <h2 className={`text-xl font-black mt-2 ${result.valid ? 'text-emerald-800' : 'text-red-700'}`}>
                {result.valid
                  ? (bn ? '✅ বৈধ সিরিয়াল — প্রবেশ অনুমোদিত' : 'Valid Serial — Admit')
                  : (bn ? `⛔ অবৈধ (${result.status})` : `Invalid (${result.status})`)}
              </h2>
              <div className="text-4xl font-black text-slate-900 mt-1">#{result.tokenNumber}</div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5 text-xs border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{bn ? 'রোগী:' : 'Patient:'}</span>
                <span className="font-extrabold text-slate-900">{result.patientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />{bn ? 'ডাক্তার:' : 'Doctor:'}</span>
                <span className="font-extrabold text-slate-900 text-right">{result.doctorName}<span className="block text-[10px] text-teal-700">{result.specialization}</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{bn ? 'চেম্বার:' : 'Chamber:'}</span>
                <span className="font-bold text-slate-800 text-right">{result.facilityName || ''} {result.chamberRoom ? `· ${result.chamberRoom}` : ''}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{bn ? 'তারিখ:' : 'Date:'}</span>
                <span className="font-bold text-slate-800">{dateFmt.format(new Date(result.startTime))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{bn ? 'সময়:' : 'Time:'}</span>
                <span className="font-bold text-slate-800">{timeFmt.format(new Date(result.startTime))} – {timeFmt.format(new Date(result.endTime))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{bn ? 'পেমেন্ট:' : 'Payment:'}</span>
                <span className="font-extrabold text-teal-700">৳{result.fee} · {result.paymentStatus}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" />{bn ? 'স্ট্যাটাস:' : 'Status:'}</span>
                <span className="font-bold text-slate-800 uppercase">{result.status}</span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
