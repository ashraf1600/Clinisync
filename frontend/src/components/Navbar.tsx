import React, { useState, useEffect } from 'react';
import { Home, Stethoscope, Calendar, Clock, Bell, Shield, User as UserIcon, LogOut, UserPlus, Zap, Activity, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadCount: number;
  openNotifications: () => void;
  openLogin: () => void;
  openProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  unreadCount,
  openNotifications,
  openLogin,
  openProfile,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id: string) => {
    setMenuOpen(false);
    setActiveTab(id);
  };

  // Role-based navigation items
  const getNavItems = () => {
    if (!isAuthenticated || !user) {
      // Guest: Clear, useful, and distinct patient buttons (no redundant booking tab, no admin portal)
      return [
        { id: 'home', label: t('nav.home', 'Home'), icon: Home },
        { id: 'doctors', label: t('nav.doctors_book', 'Find Doctor & Book'), icon: Stethoscope },
        { id: 'live-tracker', label: t('nav.live_tracker', 'Live Token Tracker'), icon: Activity },
        { id: 'my-appointments', label: t('nav.my_bookings', 'My Bookings & Pass'), icon: Clock },
      ];
    }

    if (user.role === 'patient') {
      return [
        { id: 'home', label: t('nav.home', 'Home'), icon: Home },
        { id: 'doctors', label: t('nav.doctors_book', 'Find Doctor & Book'), icon: Stethoscope },
        { id: 'live-tracker', label: t('nav.live_tracker', 'Live Token Tracker'), icon: Activity },
        { id: 'my-appointments', label: t('nav.my_bookings', 'My Bookings & Pass'), icon: Clock },
      ];
    }

    if (user.role === 'doctor') {
      // Doctor does NOT need patient tracker; they have the real-time Chamber Control Console!
      // Profile is accessed directly by clicking their name in the top bar.
      return [
        { id: 'chamber', label: t('nav.chamber', 'Chamber Queue'), icon: Stethoscope },
        { id: 'schedule', label: t('nav.slots', 'Slot & Shifts'), icon: Zap },
        { id: 'doctors', label: t('nav.specialists', 'Specialists'), icon: Stethoscope },
      ];
    }

    if (user.role === 'admin') {
      return [
        { id: 'admin', label: t('nav.admin', 'Analytics & Audit'), icon: Shield },
        { id: 'onboarding', label: t('nav.onboarding', 'Doctor Onboarding'), icon: UserPlus },
        { id: 'schedule', label: t('nav.slots', 'Slot Generator'), icon: Zap },
        { id: 'chamber', label: t('nav.chamber', 'Doctor Queue'), icon: Stethoscope },
      ];
    }

    return [
      { id: 'home', label: t('nav.home', 'Home'), icon: Home },
      { id: 'doctors', label: t('nav.doctors_book', 'Find Doctor & Book'), icon: Stethoscope },
      { id: 'live-tracker', label: t('nav.live_tracker', 'Live Token Tracker'), icon: Activity },
    ];
  };

  const navItems = getNavItems();

  return (
    <header className={`bg-slate-950/85 backdrop-blur-xl text-white sticky top-0 z-40 border-b border-white/10 transition-shadow ${scrolled ? 'shadow-lg shadow-black/40' : ''}`}>
      <div className="h-[3px] bg-gradient-to-r from-teal-400 via-blue-500 to-teal-400" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group shrink-0"
          onClick={() => go(isAuthenticated && user?.role === 'doctor' ? 'chamber' : isAuthenticated && user?.role === 'admin' ? 'admin' : 'home')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-teal-500 flex items-center justify-center font-black text-xl shadow-lg shadow-teal-500/30 group-hover:scale-105 transition">
            🩺
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Clini<span className="text-teal-400">Sync</span>
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block -mt-1 font-semibold uppercase tracking-wider">
              Smart Clinic & Queue System
            </span>
          </div>
        </div>

        {/* Navigation Tabs (desktop) */}
        <nav className="hidden md:flex space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-md shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Language Toggle (EN / বাংলা) */}
          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
            title="Switch Language / ভাষা পরিবর্তন করুন"
          >
            <span className={language === 'en' ? 'text-teal-400 font-bold' : 'text-slate-400'}>EN</span>
            <span className="text-slate-500 text-[10px]">|</span>
            <span className={language === 'bn' ? 'text-teal-400 font-bold' : 'text-slate-400'}>বাংলা</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={openNotifications}
            className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Auth Pill with Click-to-Update Profile */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700/80 rounded-full pl-1.5 pr-1.5 py-1 shadow-sm">
              <button
                onClick={openProfile}
                className="flex items-center space-x-2 hover:bg-slate-700/70 rounded-full py-0.5 px-2 transition group cursor-pointer"
                title="Click to view and update profile"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-[11px] font-black text-white shadow-sm group-hover:scale-105 transition">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="hidden min-[420px]:inline text-xs text-slate-200 font-bold max-w-[110px] truncate group-hover:text-teal-300 transition">
                  {user.name}
                </span>
                <span
                  className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                      : user.role === 'doctor'
                      ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                      : 'bg-teal-900/80 text-teal-200 border border-teal-700'
                  }`}
                >
                  {user.role}
                </span>
              </button>
              <button
                onClick={logout}
                className="p-1 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-700 transition cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={openLogin}
              className="hidden sm:flex items-center space-x-1.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-teal-500/25 transition cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>{t('nav.login', 'Login')}</span>
            </button>
          )}

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-xl px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {!isAuthenticated && (
            <button
              onClick={() => { setMenuOpen(false); openLogin(); }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow cursor-pointer"
            >
              <UserIcon className="w-4 h-4" />
              <span>{t('nav.login', 'Login')}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
