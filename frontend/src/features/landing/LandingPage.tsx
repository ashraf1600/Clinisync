import React from 'react';
import {
  Stethoscope,
  Activity,
  Ticket,
  ShieldCheck,
  QrCode,
  Wallet,
  Languages,
  Building2,
  Search,
  CalendarCheck,
  BellRing,
  ArrowRight,
  Star,
  Clock,
  BadgeCheck,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface LandingPageProps {
  onNavigate: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { language } = useLanguage();
  const bn = language === 'bn';

  const stats = [
    { value: bn ? '৫০+' : '50+', label: bn ? 'বিশেষজ্ঞ ডাক্তার' : 'Specialist Doctors' },
    { value: bn ? '১০,০০০+' : '10,000+', label: bn ? 'সফল সিরিয়াল' : 'Serials Completed' },
    { value: bn ? '০' : '0', label: bn ? 'ডাবল-বুকিং' : 'Double Bookings' },
    { value: bn ? '৳০' : '৳0', label: bn ? 'অগ্রিম পেমেন্ট' : 'Advance Payment' },
  ];

  const features = [
    {
      icon: Activity,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      title: bn ? 'লাইভ সিরিয়াল ট্র্যাকার' : 'Live Serial Tracker',
      desc: bn
        ? 'চেম্বারে বসেই দেখুন চলমান সিরিয়াল, অপেক্ষমাণ রোগী ও আপনার আনুমানিক ডাকের সময়।'
        : 'Watch the running serial, waiting queue and your estimated turn time in real time.',
    },
    {
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      title: bn ? 'জিরো ডাবল-বুকিং গ্যারান্টি' : 'Zero Double-Booking',
      desc: bn
        ? 'ডাটাবেজ-লেভেল সুরক্ষায় একই স্লটে দুজন কখনোই বুকিং পাবেন না।'
        : 'Database-level protection means the same slot can never be booked twice.',
    },
    {
      icon: QrCode,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      title: bn ? 'ডিজিটাল চেম্বার পাস' : 'Digital Chamber Pass',
      desc: bn
        ? 'বুকিংয়ের সাথে সাথে QR স্লিপ — রিসেপশনে স্ক্যান করেই প্রবেশ।'
        : 'Instant QR slip with every booking — scan at reception and walk in.',
    },
    {
      icon: Wallet,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      title: bn ? 'অগ্রিম টাকা ছাড়াই বুকিং' : 'No Advance Needed',
      desc: bn
        ? 'অনলাইনে কোনো পেমেন্ট নয় — ফি দেবেন চেম্বারে গিয়ে।'
        : 'No online payment at all — pay the fee at the chamber.',
    },
    {
      icon: Languages,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      title: bn ? 'বাংলা ও English' : 'Bilingual',
      desc: bn
        ? 'পুরো ওয়েবসাইট এক ক্লিকে বাংলা–English বদলে ব্যবহার করুন।'
        : 'Use the whole website in Bangla or English with one tap.',
    },
    {
      icon: Building2,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      title: bn ? 'মাল্টি-চেম্বার ডাক্তার' : 'Multi-Chamber Doctors',
      desc: bn
        ? 'একজন ডাক্তারের সব হাসপাতাল-চেম্বার, সময় ও ফি এক জায়গায়।'
        : 'Every hospital chamber, timing and fee of a doctor in one place.',
    },
  ];

  const steps = [
    {
      n: bn ? '১' : '1',
      icon: Search,
      title: bn ? 'ডাক্তার খুঁজুন' : 'Find a Doctor',
      desc: bn ? 'বিভাগ, নাম বা হাসপাতাল দিয়ে সার্চ করুন।' : 'Search by specialty, name or hospital.',
    },
    {
      n: bn ? '২' : '2',
      icon: CalendarCheck,
      title: bn ? 'সিরিয়াল বুক করুন' : 'Book Your Serial',
      desc: bn ? 'পছন্দের দিন-সময় বেছে ১ ক্লিকে টোকেন নিন।' : 'Pick a day and time, get your token in 1 tap.',
    },
    {
      n: bn ? '৩' : '3',
      icon: BellRing,
      title: bn ? 'লাইভ ট্র্যাক করুন' : 'Track It Live',
      desc: bn ? 'চলমান সিরিয়াল দেখে সঠিক সময়ে চেম্বারে যান।' : 'Follow the live serial and arrive right on time.',
    },
  ];

  return (
    <div className="font-sans">
      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/60 via-slate-950 to-blue-950/60" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 bg-teal-500/15 text-teal-300 text-xs font-bold px-4 py-1.5 rounded-full border border-teal-500/30">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              {bn ? 'ডিজিটাল ক্লিনিক সিরিয়াল সিস্টেম' : 'Digital Clinic Serial System'}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              {bn ? (
                <>ডাক্তারের <span className="text-teal-400">সিরিয়াল</span> এখন হাতের মুঠোয়</>
              ) : (
                <>Doctor <span className="text-teal-400">Serials</span> in Your Pocket</>
              )}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              {bn
                ? 'লাইনে দাঁড়িয়ে ঘণ্টার পর ঘণ্টা অপেক্ষা নয়। CliniSync-এ ডাক্তার খুঁজুন, সিরিয়াল বুক করুন, আর লাইভ ট্র্যাকারে দেখে সঠিক সময়ে চেম্বারে পৌঁছান — কোনো অগ্রিম টাকা ছাড়াই।'
                : 'No more hours in line. Find doctors on CliniSync, book your serial, follow the live tracker and walk in right on time — with zero advance payment.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('doctors')}
                className="px-7 py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl text-sm font-black transition shadow-lg shadow-teal-500/25 flex items-center gap-2 cursor-pointer"
              >
                <Ticket className="w-4 h-4" />
                {bn ? 'এখনই সিরিয়াল নিন' : 'Book Serial Now'}
              </button>
              <button
                onClick={() => onNavigate('live-tracker')}
                className="px-7 py-3.5 bg-white/10 hover:bg-white/15 text-white rounded-2xl text-sm font-bold transition border border-white/20 flex items-center gap-2 cursor-pointer"
              >
                <Activity className="w-4 h-4 text-teal-300" />
                {bn ? 'লাইভ কিউ দেখুন' : 'View Live Queue'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-teal-400" />{bn ? 'BMDC যাচাইকৃত ডাক্তার' : 'BMDC-verified doctors'}</span>
              <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400" />{bn ? 'রোগীদের আস্থা' : 'Trusted by patients'}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-teal-400" />{bn ? 'রিয়েল-টাইম আপডেট' : 'Real-time updates'}</span>
            </div>
          </div>

          {/* Hero visual: live serial card */}
          <div className="relative">
            <div className="bg-white text-slate-900 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  {bn ? 'লাইভ চেম্বার' : 'Live Chamber'}
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> LIVE
                </span>
              </div>
              <div className="bg-gradient-to-br from-teal-700 to-slate-900 text-white rounded-2xl p-5 text-center">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-widest">
                  {bn ? 'চলমান সিরিয়াল' : 'Now Serving'}
                </span>
                <div className="text-6xl font-black my-1">#7</div>
                <span className="text-xs text-teal-200 font-semibold">{bn ? 'আপনার সিরিয়াল #10 · আনুমানিক ৪৫ মিনিট' : 'Your serial #10 · approx. 45 min'}</span>
              </div>
              <div className="mt-4 space-y-2">
                {[8, 9, 10].map((s) => (
                  <div key={s} className={`flex items-center justify-between p-3 rounded-xl border ${s === 10 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-100'}`}>
                    <span className="font-black text-sm text-slate-800">#{s}</span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${s === 10 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {s === 10 ? (bn ? 'আপনার সিরিয়াল' : 'YOURS') : (bn ? 'অপেক্ষমাণ' : 'WAITING')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 bg-white/5 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-black text-teal-300">{s.value}</div>
                <div className="text-[11px] text-slate-400 font-semibold mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            {bn ? 'কেন CliniSync?' : 'Why CliniSync?'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {bn ? 'রোগী ও ডাক্তার — দুজনের জন্যই সহজ' : 'Simple for Patients and Doctors'}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${f.color} mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900">{f.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              {bn ? 'মাত্র ৩ ধাপে সিরিয়াল' : 'Serial in Just 3 Steps'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="relative bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center">
                  <span className="absolute top-4 right-5 text-5xl font-black text-slate-100">{s.n}</span>
                  <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white flex items-center justify-center mx-auto mb-4 shadow-md">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-extrabold text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-500 mt-1.5">{s.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <button
              onClick={() => onNavigate('doctors')}
              className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition shadow inline-flex items-center gap-2 cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              {bn ? 'ডাক্তার দেখুন' : 'Browse Doctors'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA + FOOTER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-700 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-black">
            {bn ? 'আজই আপনার সিরিয়াল নিশ্চিত করুন' : 'Secure Your Serial Today'}
          </h2>
          <p className="text-teal-100 text-sm mt-2 max-w-xl mx-auto">
            {bn
              ? 'রেজিস্ট্রেশন ফ্রি, বুকিং ফ্রি — টাকা দেবেন শুধু চেম্বারে।'
              : 'Free registration, free booking — pay only at the chamber.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              onClick={() => onNavigate('doctors')}
              className="px-7 py-3 bg-white text-teal-800 rounded-2xl text-sm font-black hover:bg-teal-50 transition shadow cursor-pointer"
            >
              {bn ? 'সিরিয়াল নিন' : 'Get Serial'}
            </button>
            <button
              onClick={() => onNavigate('live-tracker')}
              className="px-7 py-3 bg-white/15 text-white rounded-2xl text-sm font-bold hover:bg-white/25 transition border border-white/30 cursor-pointer"
            >
              {bn ? 'লাইভ ট্র্যাকার' : 'Live Tracker'}
            </button>
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-8">
          CliniSync · {bn ? 'স্মার্ট ক্লিনিক ও কিউ সিস্টেম' : 'Smart Clinic & Queue System'} · {bn ? 'রোগীর তথ্য সুরক্ষিত' : 'Patient data protected'}
        </p>
      </section>
    </div>
  );
};
