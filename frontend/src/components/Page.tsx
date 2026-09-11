import React from 'react';

/** Premium page background shell — subtle clinical gradient over slate. */
export const PageShell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className="min-h-full bg-[radial-gradient(1200px_400px_at_50%_-80px,rgba(20,184,166,0.08),transparent),radial-gradient(900px_320px_at_90%_0px,rgba(59,130,246,0.07),transparent)]">
    <div className={`${wide === false ? 'max-w-5xl' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
      {children}
    </div>
  </div>
);

interface HeroProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'teal' | 'blue' | 'slate';
}

/** Premium dark gradient hero banner shared by every route. */
export const PageHero: React.FC<HeroProps> = ({ eyebrow, title, subtitle, actions, tone = 'teal' }) => {
  const glow =
    tone === 'blue'
      ? 'from-blue-600/20 via-transparent to-teal-500/10'
      : tone === 'slate'
      ? 'from-slate-500/20 via-transparent to-teal-500/10'
      : 'from-teal-500/20 via-transparent to-blue-600/10';
  const pill =
    tone === 'blue'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : 'bg-teal-500/15 text-teal-300 border-teal-500/30';
  return (
    <div className="relative overflow-hidden bg-slate-950 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl shadow-slate-900/10 border border-slate-800">
      <div className={`absolute inset-0 bg-gradient-to-br ${glow} pointer-events-none`} />
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${pill}`}>
            {eyebrow}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: 'slate' | 'teal' | 'amber' | 'emerald' | 'blue' | 'red';
}

/** Premium KPI card with colored top value. */
export const StatCard: React.FC<StatProps> = ({ label, value, sub, accent = 'slate' }) => {
  const color: Record<string, string> = {
    slate: 'text-slate-900',
    teal: 'text-teal-700',
    amber: 'text-amber-600',
    emerald: 'text-emerald-700',
    blue: 'text-blue-700',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <p className={`text-2xl sm:text-3xl font-black mt-1 tabular-nums ${color[accent]}`}>{value}</p>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
};

interface EmptyProps {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

/** Premium empty state. */
export const EmptyState: React.FC<EmptyProps> = ({ icon, title, body, action }) => (
  <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200 shadow-sm space-y-3">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
      {icon}
    </div>
    <h3 className="text-base sm:text-lg font-black text-slate-800">{title}</h3>
    {body && <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{body}</p>}
    {action && <div className="pt-2">{action}</div>}
  </div>
);
