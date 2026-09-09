import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

// One animation expressing the whole CliniSync flow in Bangla:
// রোগী (ফোনে সিরিয়াল) → চলমান কিউ → ডাক্তারের চেম্বার।
const SERVE_CYCLE = [7, 8, 9];
const MY_SERIAL = 12;
const MIN_PER_PATIENT = 15;

const PersonWithPhone: React.FC<{ mine: number }> = ({ mine }) => (
  <svg viewBox="0 0 120 175" className="w-full h-full" role="img" aria-label="Patient with phone">
    <ellipse cx="60" cy="165" rx="30" ry="6" fill="#0F172A" opacity="0.08" />
    <rect x="44" y="128" width="13" height="32" rx="6" fill="#334155" />
    <rect x="63" y="128" width="13" height="32" rx="6" fill="#334155" />
    <rect x="36" y="62" width="48" height="72" rx="18" fill="#0F766E" />
    <rect x="36" y="62" width="48" height="14" rx="7" fill="#0D9488" opacity="0.5" />
    <circle cx="60" cy="40" r="19" fill="#EAB892" />
    <path d="M41 38 a19 19 0 0 1 38 0 l0 -6 a19 14 0 0 0 -38 0 z" fill="#1F2937" />
    <line x1="80" y1="82" x2="98" y2="98" stroke="#0B5E57" strokeWidth="9" strokeLinecap="round" />
    <g className="anim-phone-bob" style={{ transformOrigin: '99px 105px' }}>
      <rect x="84" y="78" width="30" height="54" rx="7" fill="#0F172A" />
      <rect x="88" y="86" width="22" height="34" rx="3" fill="#14B8A6" />
      <text x="99" y="102" textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFFFFF">#{mine}</text>
      <text x="99" y="113" textAnchor="middle" fontSize="6.5" fill="#CCFBF1">সিরিয়াল</text>
    </g>
  </svg>
);

const DoctorFigure: React.FC = () => (
  <svg viewBox="0 0 100 155" className="w-full h-full" role="img" aria-label="Doctor">
    <ellipse cx="50" cy="148" rx="24" ry="5" fill="#0F172A" opacity="0.08" />
    <rect x="27" y="56" width="46" height="72" rx="14" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
    <path d="M42 58 L50 78 L58 58 Z" fill="#0F766E" />
    <path d="M38 62 q-6 22 4 34" stroke="#0F766E" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M62 62 q6 22 -4 34" stroke="#0F766E" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="50" cy="100" r="5" fill="#0F766E" />
    <circle cx="50" cy="36" r="17" fill="#EAB892" />
    <path d="M33 34 a17 17 0 0 1 34 0 l0 -5 a17 12 0 0 0 -34 0 z" fill="#374151" />
    <circle cx="72" cy="66" r="9" fill="#EF4444" />
    <rect x="69" y="60" width="6" height="12" rx="1" fill="#FFFFFF" />
    <rect x="66" y="63" width="12" height="6" rx="1" fill="#FFFFFF" />
  </svg>
);

export const SystemAnimation: React.FC = () => {
  const { language } = useLanguage();
  const bn = language === 'bn';

  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % SERVE_CYCLE.length), 3600);
    return () => clearInterval(id);
  }, [paused]);

  const serving = SERVE_CYCLE[phase];
  const tokens = [serving + 1, serving + 2, MY_SERIAL];
  const etaMin = Math.max(5, (MY_SERIAL - serving) * MIN_PER_PATIENT);

  const captions = bn
    ? ['📱 ফোনে সিরিয়াল নিন', '👁️ লাইভ কিউ দেখুন', '🚪 সময়মতো চেম্বারে যান']
    : ['📱 Book on phone', '👁️ Watch live queue', '🚪 Walk in on time'];

  return (
    <div
      className="anim-float-soft"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          {bn ? 'পুরো সিস্টেম এক নজরে' : 'Whole system at a glance'}
        </span>
        <span className="flex items-center gap-1.5 bg-white/10 text-emerald-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-white/15 backdrop-blur">
          <span className="flex items-end gap-[2px] h-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-emerald-400 origin-bottom"
                style={{ height: '100%', animation: 'clinisync-eq 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </span>
          LIVE
        </span>
      </div>

      {/* Serving number — blends into hero, no banner box */}
      <div className="text-center mb-1">
        <span className="text-[10px] uppercase font-bold text-teal-300 tracking-widest block">
          {bn ? 'চলমান সিরিয়াল' : 'Now Serving'}
        </span>
        <span key={serving} className="text-6xl font-black text-white inline-block anim-serve-pop drop-shadow-[0_0_25px_rgba(20,184,166,0.45)]">#{serving}</span>
      </div>

      {/* Scene: transparent, blends with hero background */}
      <div className="relative overflow-hidden" style={{ height: 210 }}>
        {/* queue track */}
        <div className="absolute left-24 right-24 top-7 h-12">
          <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-teal-400/40" />
          {tokens.map((t, i) => (
            <span
              key={`${serving}-${t}-${i}`}
              className={`anim-token-ride absolute top-1 w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-teal-500/20 border-2 ${
                t === MY_SERIAL
                  ? 'bg-amber-500 text-white border-amber-300'
                  : 'bg-white text-teal-900 border-teal-200'
              }`}
              style={{ animationDelay: `${i * 1.2}s` }}
            >
              #{t}
            </span>
          ))}
        </div>

        {/* chamber door */}
        <div className="absolute right-2 top-4 bottom-16 w-[68px]">
          <div className="anim-door-glow w-full h-full rounded-t-2xl bg-white/5 border-2 border-teal-400/40 backdrop-blur-sm flex flex-col items-center pt-2">
            <span className="text-[9px] font-black text-teal-300 tracking-wider">চেম্বার</span>
            <span className="mt-1 w-8 h-8 rounded-full bg-teal-500/20 border border-teal-400/50" />
          </div>
        </div>

        {/* doctor beside door */}
        <div className="absolute right-[76px] bottom-14 w-14">
          <DoctorFigure />
          <p className="text-center text-[9px] font-extrabold text-slate-300 -mt-1">{bn ? 'ডাক্তার' : 'Doctor'}</p>
        </div>

        {/* patient with phone */}
        <div className="absolute left-2 bottom-1 w-24">
          <PersonWithPhone mine={MY_SERIAL} />
          <p className="text-center text-[9px] font-extrabold text-teal-300 -mt-2">
            {bn ? `আপনি · ≈${etaMin} মিনিট` : `You · ≈${etaMin} min`}
          </p>
        </div>
      </div>

      {/* synced 3-phase captions — glass pills */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {captions.map((c, i) => (
          <div
            key={c}
            className={`text-center text-[10px] font-extrabold px-1 py-2 rounded-xl border transition-all backdrop-blur ${
              i === phase
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/30'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            {c}
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-slate-500 mt-2">
        {bn ? 'ডেমো অ্যানিমেশন — আসল কিউ প্রতি ১২ সেকেন্ডে আপডেট হয়' : 'Demo — the real queue updates every 12 seconds'}
      </p>
    </div>
  );
};
