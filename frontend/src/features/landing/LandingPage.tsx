import React, { useState, useEffect } from 'react';
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
  Phone,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface LandingPageProps {
  onNavigate: (tab: string) => void;
}

// Simulated live chamber: serving serial ticks forward like the real tracker
const SERVE_CYCLE = [7, 8, 9];
const MY_SERIAL = 10;
const MIN_PER_PATIENT = 15;

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { language } = useLanguage();
  const bn = language === 'bn';

  // Ticking LIVE demo
  const [serveIdx, setServeIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setServeIdx((i) => (i + 1) % SERVE_CYCLE.length), 3000);
    return () => clearInterval(id);
  }, [paused]);
  const serving = SERVE_CYCLE[serveIdx];
  const upcomingRows = [serving + 1, serving + 2, MY_SERIAL];
  const etaMin = Math.max(5, (MY_SERIAL - serving) * MIN_PER_PATIENT);

  // Auto-cycling 3 steps
  const [activeStep, setActiveStep] = useState(0);
  const [stepsPaused, setStepsPaused] = useState(false);
  useEffect(() => {
    if (stepsPaused) return;
    const id = setInterval(() => setActiveStep((s) => (s + 1) % 3), 2800);
    return () => clearInterval(id);
  }, [stepsPaused]);

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
      icon: Search,
      title: bn ? 'ডাক্তার খুঁজুন' : 'Find a Doctor',
      desc: bn ? 'বিভাগ, নাম বা হাসপাতাল দিয়ে সার্চ করে চেম্বার ও ফি দেখুন।' : 'Search by specialty, name or hospital — see chambers and fees.',
      action: bn ? 'ডাক্তার দেখুন' : 'Browse doctors',
      tab: 'doctors',
    },
    {
      icon: CalendarCheck,
      title: bn ? 'সিরিয়াল বুক করুন' : 'Book Your Serial',
      desc: bn ? 'পছন্দের দিন-সময় বেছে ১ ক্লিকে টোকেন ও QR স্লিপ নিন।' : 'Pick a day and time — get your token and QR slip in 1 tap.',
      action: bn ? 'বুকিং শুরু করুন' : 'Start booking',
      tab: 'doctors',
    },
    {
      icon: BellRing,
      title: bn ? 'লাইভ ট্র্যাক করুন' : 'Track It Live',
      desc: bn ? 'চলমান সিরিয়াল ও আনুমানিক অপেক্ষা দেখে ঠিক সময়ে যান।' : 'Follow the running serial and wait estimate — arrive right on time.',
      action: bn ? 'লাইভ কিউ খুলুন' : 'Open live queue',
      tab: 'live-tracker',
    },
  ];

  const partners = ['Popular Diagnostic', 'Square Hospital', 'Evercare Hospital', 'Ibn Sina Diagnostic'];

  return (
    <div className="font-sans">
      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/60 via-slate-950 to-blue-950/60" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 anim-fade-up">
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

          {/* LIVE demo card — serving serial ticks forward every 3s */}
          <div className="relative anim-fade-up" style={{ animationDelay: '0.15s' }}>
            <div
              className="bg-white text-slate-900 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-md mx-auto anim-float-soft"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  {bn ? 'লাইভ চেম্বার' : 'Live Chamber'}
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-200">
                  {/* equalizer bars */}
                  <span className="flex items-end gap-[2px] h-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-[3px] rounded-full bg-emerald-500 origin-bottom"
                        style={{ height: '100%', animation: 'clinisync-eq 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </span>
                  LIVE
                </span>
              </div>
              <div className="bg-gradient-to-br from-teal-700 to-slate-900 text-white rounded-2xl p-5 text-center overflow-hidden">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-widest">
                  {bn ? 'চলমান সিরিয়াল' : 'Now Serving'}
                </span>
                <div key={serving} className="text-6xl font-black my-1 anim-serve-pop">#{serving}</div>
                <span className="text-xs text-teal-200 font-semibold">
                  {bn ? `আপনার সিরিয়াল #${MY_SERIAL} · আনুমানিক ${etaMin} মিনিট` : `Your serial #${MY_SERIAL} · approx. ${etaMin} min`}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {upcomingRows.map((s, idx) => {
                  const mine = s === MY_SERIAL;
                  return (
                    <div
                      key={`${serving}-${s}`}
                      className={`flex items-center justify-between p-3 rounded-xl border anim-row-in ${mine ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-100'}`}
                      style={{ animationDelay: `${idx * 0.12}s` }}
                    >
                      <span className="font-black text-sm text-slate-800">#{s}</span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${mine ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {mine ? (bn ? 'আপনার সিরিয়াল' : 'YOURS') : (bn ? 'অপেক্ষমাণ' : 'WAITING')}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-[10px] text-slate-400 mt-3">
                {bn ? 'ডেমো অ্যানিমেশন — আসল কিউ প্রতি ১২ সেকেন্ডে আপডেট হয়' : 'Demo animation — the real queue updates every 12 seconds'}
              </p>
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

      {/* PARTNERS */}
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {bn ? 'সহযোগী হাসপাতাল' : 'Partner Hospitals'}
          </span>
          {partners.map((p) => (
            <span key={p} className="text-sm font-extrabold text-slate-400 hover:text-teal-700 transition">{p}</span>
          ))}
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

      {/* HOW IT WORKS — auto-cycling animated steps */}
      <section className="bg-slate-950 text-white border-y border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-950/40 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-300 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30">
              {bn ? 'ব্যবহার পদ্ধতি' : 'How It Works'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-3">
              {bn ? 'মাত্র ৩ ধাপে সিরিয়াল' : 'Serial in Just 3 Steps'}
            </h2>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
            onMouseEnter={() => setStepsPaused(true)}
            onMouseLeave={() => setStepsPaused(false)}
          >
            {steps.map((s, i) => {
              const Icon = s.icon;
              const active = i === activeStep;
              return (
                <button
                  key={s.title}
                  onClick={() => { setActiveStep(i); onNavigate(s.tab); }}
                  className={`relative rounded-3xl p-6 border text-left transition-all duration-300 cursor-pointer overflow-hidden ${
                    active
                      ? 'bg-white text-slate-900 border-teal-400 shadow-2xl shadow-teal-500/20 scale-[1.02]'
                      : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                  }`}
                >
                  {/* progress fill while active */}
                  {active && !stepsPaused && (
                    <span
                      key={activeStep}
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-teal-400 to-blue-500"
                      style={{ animation: 'clinisync-progress-fill 2.8s linear both' }}
                    />
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${active ? 'bg-teal-600 text-white shadow-md' : 'bg-white/10 text-teal-300'}`}>
                      <Icon className="w-6 h-6" />
                    </span>
                    <span className={`text-5xl font-black ${active ? 'text-teal-100' : 'text-white/10'}`}>
                      {bn ? ['১', '২', '৩'][i] : i + 1}
                    </span>
                  </div>
                  <h3 className={`font-extrabold ${active ? 'text-slate-900' : ''}`}>{s.title}</h3>
                  <p className={`text-xs mt-1.5 leading-relaxed ${active ? 'text-slate-500' : 'text-slate-400'}`}>{s.desc}</p>
                  <span className={`inline-flex items-center gap-1.5 mt-4 text-xs font-bold ${active ? 'text-teal-700' : 'text-teal-300'}`}>
                    {s.action} <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
          {/* step dots */}
          <div className="flex justify-center gap-2 mt-8">
            {steps.map((s, i) => (
              <button
                key={s.title}
                aria-label={`Step ${i + 1}`}
                onClick={() => setActiveStep(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${i === activeStep ? 'w-8 bg-teal-400' : 'w-2 bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-700 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-2xl sm:text-3xl font-black relative">
            {bn ? 'আজই আপনার সিরিয়াল নিশ্চিত করুন' : 'Secure Your Serial Today'}
          </h2>
          <p className="text-teal-100 text-sm mt-2 max-w-xl mx-auto relative">
            {bn
              ? 'রেজিস্ট্রেশন ফ্রি, বুকিং ফ্রি — টাকা দেবেন শুধু চেম্বারে।'
              : 'Free registration, free booking — pay only at the chamber.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6 relative">
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
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-teal-500 flex items-center justify-center text-lg">🩺</div>
              <span className="text-lg font-extrabold text-white">Clini<span className="text-teal-400">Sync</span></span>
            </div>
            <p className="text-xs leading-relaxed">
              {bn
                ? 'স্মার্ট ক্লিনিক ও কিউ সিস্টেম — লাইনে দাঁড়ানো ছাড়াই ডাক্তারের সিরিয়াল, লাইভ ট্র্যাকিং ও ডিজিটাল চেম্বার পাস।'
                : 'Smart clinic and queue system — doctor serials, live tracking and digital chamber passes with no standing in line.'}
            </p>
          </div>
          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-3">{bn ? 'সেবা' : 'Services'}</h4>
            <div className="flex flex-col items-start gap-2 text-xs font-semibold">
              {[
                { label: bn ? 'ডাক্তার খুঁজুন' : 'Find doctors', tab: 'doctors' },
                { label: bn ? 'লাইভ ট্র্যাকার' : 'Live tracker', tab: 'live-tracker' },
                { label: bn ? 'আমার সিরিয়াল' : 'My serials', tab: 'my-appointments' },
              ].map((l) => (
                <button key={l.tab} onClick={() => onNavigate(l.tab)} className="hover:text-teal-300 transition flex items-center gap-1 cursor-pointer">
                  <ChevronRight className="w-3 h-3" /> {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white text-xs font-extrabold uppercase tracking-widest mb-3">{bn ? 'যোগাযোগ' : 'Contact'}</h4>
            <div className="space-y-2 text-xs font-semibold">
              <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-teal-400" /> +880 1700-000000</span>
              <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-teal-400" />{bn ? 'ঢাকা, বাংলাদেশ' : 'Dhaka, Bangladesh'}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <p className="text-center text-[11px] py-4">
            CliniSync · {bn ? 'রোগীর তথ্য সুরক্ষিত' : 'Patient data protected'} · 2026
          </p>
        </div>
      </footer>
    </div>
  );
};
