import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { NotificationDrawer } from './components/NotificationDrawer';
import { DoctorsPage } from './features/doctors/DoctorsPage';
import { BookingPage } from './features/appointments/BookingPage';
import { PatientAppointmentsPage } from './features/appointments/PatientAppointmentsPage';
import { LiveQueueTrackerPage } from './features/appointments/LiveQueueTrackerPage';
import { DoctorChamberPage } from './features/appointments/DoctorChamberPage';
import { ScheduleManagerPage } from './features/availability/ScheduleManagerPage';
import { DoctorOnboardingPage } from './features/admin/DoctorOnboardingPage';
import { AdminPage } from './features/admin/AdminPage';
import { DoctorProfilePage } from './features/doctors/DoctorProfilePage';
import { LandingPage } from './features/landing/LandingPage';
import { AuthModal } from './features/auth/components/AuthModal';
import { ProfileModal } from './features/auth/components/ProfileModal';
import { Doctor } from './features/doctors/types';
import { Lock, ShieldAlert, LogIn, ArrowRight } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: ('patient' | 'doctor' | 'admin')[];
  requiredRoleName: string;
  onOpenLogin: () => void;
  children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  requiredRoleName,
  onOpenLogin,
  children,
}) => {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-5">
          <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Role Access Protected
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-2">Authentication Required</h3>
            <p className="text-xs text-slate-500 mt-1">
              Access to this console requires an authenticated <span className="font-bold text-slate-700">{requiredRoleName}</span> account.
            </p>
          </div>

          <button
            onClick={onOpenLogin}
            className="w-full py-3 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In with Clinic Credentials</span>
          </button>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(user.role as any)) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl p-8 border border-red-200 shadow-xl space-y-5">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
              Access Restricted
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-2">Insufficient Permissions</h3>
            <p className="text-xs text-slate-500 mt-1">
              You are signed in as <span className="font-bold text-slate-800">{user.name}</span> (<span className="uppercase text-[10px] font-black text-teal-700">{user.role}</span>). This area is strictly reserved for <span className="font-bold text-slate-800">{requiredRoleName}</span> users.
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow transition"
          >
            Switch Account / Log Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const validTabs = ['home', 'doctors', 'book', 'live-tracker', 'my-appointments', 'chamber', 'schedule', 'doctor-profile', 'onboarding', 'admin'];

const getInitialTab = (): string => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '');
    if (hash && validTabs.includes(hash)) {
      return hash;
    }
  }
  return 'home';
};

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(1);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Default redirect when switching roles only if landing on home with no deep link
  useEffect(() => {
    if (isAuthenticated && user) {
      if (!window.location.hash || window.location.hash === '#home') {
        if (user.role === 'doctor') {
          handleTabChange('chamber');
        } else if (user.role === 'admin') {
          handleTabChange('admin');
        }
      }
    }
  }, [isAuthenticated, user?.role]);

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctorForBooking(doctor);
    handleTabChange('book');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        unreadCount={unreadCount}
        openNotifications={() => setIsNotificationOpen(true)}
        openLogin={() => setIsLoginModalOpen(true)}
        openProfile={() => setIsProfileModalOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <LandingPage onNavigate={handleTabChange} />
        )}

        {activeTab === 'doctors' && (
          <DoctorsPage onSelectDoctorForBooking={handleSelectDoctor} />
        )}

        {activeTab === 'book' && (
          <BookingPage
            selectedDoctor={selectedDoctorForBooking}
            onBookingComplete={() => handleTabChange('my-appointments')}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {activeTab === 'live-tracker' && (
          <LiveQueueTrackerPage
            onSelectDoctorForBooking={handleSelectDoctor}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {activeTab === 'my-appointments' && (
          <RoleGuard
            allowedRoles={['patient', 'admin']}
            requiredRoleName="Patient"
            onOpenLogin={() => setIsLoginModalOpen(true)}
          >
            <PatientAppointmentsPage
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onNavigateToDoctors={() => handleTabChange('doctors')}
            />
          </RoleGuard>
        )}

        {activeTab === 'chamber' && (
          <RoleGuard
            allowedRoles={['doctor', 'admin']}
            requiredRoleName="Doctor / Medical Staff"
            onOpenLogin={() => setIsLoginModalOpen(true)}
          >
            <DoctorChamberPage />
          </RoleGuard>
        )}

        {activeTab === 'schedule' && (
          <RoleGuard
            allowedRoles={['doctor', 'admin']}
            requiredRoleName="Doctor / Clinic Admin"
            onOpenLogin={() => setIsLoginModalOpen(true)}
          >
            <ScheduleManagerPage />
          </RoleGuard>
        )}

        {activeTab === 'doctor-profile' && (
          <RoleGuard
            allowedRoles={['doctor']}
            requiredRoleName="Doctor"
            onOpenLogin={() => setIsLoginModalOpen(true)}
          >
            <DoctorProfilePage />
          </RoleGuard>
        )}

        {activeTab === 'onboarding' && (
          <RoleGuard
            allowedRoles={['admin']}
            requiredRoleName="System Administrator"
            onOpenLogin={() => setIsLoginModalOpen(true)}
          >
            <DoctorOnboardingPage />
          </RoleGuard>
        )}

        {activeTab === 'admin' && (
          <RoleGuard
            allowedRoles={['admin']}
            requiredRoleName="System Administrator"
            onOpenLogin={() => setIsLoginModalOpen(true)}
          >
            <AdminPage />
          </RoleGuard>
        )}
      </main>

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onRefreshUnread={() => setUnreadCount(0)}
      />

      <AuthModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

import { LanguageProvider } from './context/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

// Version 1.1.1 - CliniSync Platform
export default App;
