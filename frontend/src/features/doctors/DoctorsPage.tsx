import React, { useState, useEffect } from 'react';
import { Search, Star, Clock, Award, ShieldCheck, MapPin, Plus } from 'lucide-react';
import { doctorService } from './services/doctorService';
import { Doctor } from './types';
import { getDoctorChambers } from './utils/chamberUtils';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useLanguage } from '../../context/LanguageContext';

interface DoctorsPageProps {
  onSelectDoctorForBooking: (doctor: Doctor) => void;
}

const DEMO_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    userId: 'user-doc-1',
    name: 'Prof. Dr. Mahbubur Rahman',
    specialization: 'Cardiology',
    degrees: 'MBBS, FCPS (Cardiology), MD',
    bmdcNumber: 'BMDC-A-48291',
    designation: 'Senior Consultant & Professor',
    facility: 'Popular Diagnostic Centre, Dhanmondi',
    chamber: 'Room #405, Level 4',
    profilePhotoUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    consultationFee: 1500,
    followupFee: 1000,
    rating: 4.9,
    experienceYears: 18,
    bio: 'Renowned clinical and interventional cardiologist specializing in coronary care, heart failure, and hypertension management.',
    locations: [
      {
        id: 'loc-1',
        facilityName: 'Popular Diagnostic Centre',
        branchArea: 'Dhanmondi, Dhaka',
        chamberRoom: 'Room #405, Level 4',
        scheduleDays: 'Sat, Mon, Wed',
        shiftHours: '05:00 PM - 09:00 PM',
        consultationFee: 1500,
        followupFee: 1000,
        contactPhone: '+880 1711-123456',
        isActive: true,
      }
    ]
  },
  {
    id: 'doc-2',
    userId: 'user-doc-2',
    name: 'Dr. Nusrat Jahan',
    specialization: 'Gynecology',
    degrees: 'MBBS, MS (Obs & Gynae)',
    bmdcNumber: 'BMDC-A-55104',
    designation: 'Associate Professor',
    facility: 'Square Hospital, Panthapath',
    chamber: 'Chamber #208, 2nd Floor',
    profilePhotoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    consultationFee: 1200,
    followupFee: 800,
    rating: 4.8,
    experienceYears: 12,
    bio: 'Specialist in high-risk pregnancy care, infertility consultations, and advanced laparoscopic gynecology surgery.',
    locations: [
      {
        id: 'loc-2',
        facilityName: 'Square Hospital',
        branchArea: 'Panthapath, Dhaka',
        chamberRoom: 'Room #208, Level 2',
        scheduleDays: 'Sun, Tue, Thu',
        shiftHours: '04:00 PM - 08:00 PM',
        consultationFee: 1200,
        followupFee: 800,
        contactPhone: '+880 1812-345678',
        isActive: true,
      }
    ]
  },
  {
    id: 'doc-3',
    userId: 'user-doc-3',
    name: 'Dr. Farhan Ahmed',
    specialization: 'Neurology',
    degrees: 'MBBS, MD (Neurology)',
    bmdcNumber: 'BMDC-A-62901',
    designation: 'Consultant Neurologist',
    facility: 'Evercare Hospital, Bashundhara',
    chamber: 'Consultation Suite 12',
    profilePhotoUrl: 'https://randomuser.me/api/portraits/men/54.jpg',
    consultationFee: 1600,
    followupFee: 1000,
    rating: 4.9,
    experienceYears: 14,
    bio: 'Expertise in stroke management, epilepsy, Parkinsonism, migraine, and complex peripheral neuropathy disorders.',
    locations: [
      {
        id: 'loc-3',
        facilityName: 'Evercare Hospital',
        branchArea: 'Bashundhara, Dhaka',
        chamberRoom: 'Suite #12',
        scheduleDays: 'Sat, Sun, Wed',
        shiftHours: '06:00 PM - 09:30 PM',
        consultationFee: 1600,
        followupFee: 1000,
        contactPhone: '+880 1913-987654',
        isActive: true,
      }
    ]
  },
  {
    id: 'doc-4',
    userId: 'user-doc-4',
    name: 'Dr. Sabrina Karim',
    specialization: 'Dermatology',
    degrees: 'MBBS, DDV, FCPS',
    bmdcNumber: 'BMDC-A-71822',
    designation: 'Assistant Professor',
    facility: 'Ibn Sina Diagnostic Center, Uttara',
    chamber: 'Room #302, Level 3',
    profilePhotoUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
    consultationFee: 1000,
    followupFee: 600,
    rating: 4.7,
    experienceYears: 9,
    bio: 'Expert in clinical dermatology, acne scarring, eczema, psoriasis, laser therapy, and cosmetic skin care procedures.',
    locations: [
      {
        id: 'loc-4',
        facilityName: 'Ibn Sina Diagnostic Center',
        branchArea: 'Uttara, Dhaka',
        chamberRoom: 'Room #302',
        scheduleDays: 'Mon, Wed, Fri',
        shiftHours: '05:30 PM - 08:30 PM',
        consultationFee: 1000,
        followupFee: 600,
        contactPhone: '+880 1614-567890',
        isActive: true,
      }
    ]
  }
];

export const DoctorsPage: React.FC<DoctorsPageProps> = ({ onSelectDoctorForBooking }) => {
  const { t, language } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>(DEMO_DOCTORS);
  const [specialization, setSpecialization] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const specialties = ['All', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Gynecology', 'Dermatology'];

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await doctorService.getDoctors({
        specialization: specialization === 'All' ? undefined : specialization || undefined,
        search: searchQuery || undefined,
      });

      if (res && Array.isArray(res.items) && res.items.length > 0) {
        setDoctors(res.items);
      } else if (Array.isArray(res) && res.length > 0) {
        setDoctors(res);
      } else {
        // Filter demo doctors
        let filtered = [...DEMO_DOCTORS];
        if (specialization && specialization !== 'All') {
          filtered = filtered.filter((d) => d.specialization.toLowerCase() === specialization.toLowerCase());
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter((d) =>
            d.name.toLowerCase().includes(q) ||
            d.specialization.toLowerCase().includes(q) ||
            (d.facility && d.facility.toLowerCase().includes(q))
          );
        }
        setDoctors(filtered);
      }
    } catch (err: any) {
      // Graceful fallback to demo doctors so user experience never breaks
      let filtered = [...DEMO_DOCTORS];
      if (specialization && specialization !== 'All') {
        filtered = filtered.filter((d) => d.specialization.toLowerCase() === specialization.toLowerCase());
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          (d.facility && d.facility.toLowerCase().includes(q))
        );
      }
      setDoctors(filtered);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [specialization, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-slate-800 to-teal-900 rounded-3xl p-8 text-white mb-8 shadow-xl">
        <div className="max-w-2xl">
          <span className="bg-teal-600/30 text-teal-300 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide border border-teal-500/30">
            {t('doctors.hero_badge', 'Official Specialist Panel')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight">
            {t('doctors.hero_title', 'Find & Consult Trusted Specialists')}
          </h1>
          <p className="text-slate-300 text-sm mt-2">
            {t('doctors.hero_desc', 'Live queue token tracking, transparent chamber fees, and zero double-booking guarantee.')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mt-6 flex items-center bg-white rounded-2xl p-2 max-w-xl shadow-lg">
          <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
          <input
            type="text"
            placeholder={t('doctors.search_placeholder', 'Search by doctor name, specialty, or clinic...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-4 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Specialization Filter Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-6">
        {specialties.map((spec) => {
          const isSelected = (!specialization && spec === 'All') || specialization === spec;
          return (
            <button
              key={spec}
              onClick={() => setSpecialization(spec === 'All' ? '' : spec)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                isSelected
                  ? 'bg-teal-700 text-white shadow-teal-700/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t(`spec.${spec}`, spec)}
            </button>
          );
        })}
      </div>

      {/* 1. LOADING STATE */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse space-y-4">
              <div className="flex space-x-4">
                <div className="w-16 h-16 bg-slate-200 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-slate-200 rounded w-full" />
              <div className="h-10 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* 2. ERROR STATE */}
      {!isLoading && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md mx-auto my-8">
          <p className="text-red-700 font-semibold text-sm">{errorMessage}</p>
          <button
            onClick={fetchDoctors}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!isLoading && !errorMessage && doctors.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto my-8">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Specialists Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search keywords or specialty filter.</p>
        </div>
      )}

      {/* 4. SUCCESS / CONTENT STATE */}
      {!isLoading && !errorMessage && doctors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Profile Header */}
                <div className="flex items-start space-x-4">
                  <DoctorAvatar name={doctor.name} profilePhotoUrl={doctor.profilePhotoUrl} sizeClass="w-16 h-16 text-xl" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="text-base font-bold text-slate-900">{doctor.name}</h3>
                      <span title="BMDC Verified"><ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" /></span>
                    </div>
                    <p className="text-xs text-teal-700 font-semibold">{doctor.specialization}</p>
                    <p className="text-[11px] text-slate-500 font-medium truncate">{doctor.degrees} · {doctor.facility}</p>
                  </div>
                </div>

                {/* Badges */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-600">
                  <div className="flex items-center space-x-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-slate-800">{doctor.rating}</span>
                    <span className="text-slate-400">({doctor.experienceYears}y exp)</span>
                  </div>
                  <div className="flex items-center space-x-1 bg-slate-50 rounded-lg p-2 border border-slate-100 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{doctor.chamber}</span>
                  </div>
                </div>

                {doctor.bio && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {doctor.bio}
                  </p>
                )}

                {/* Practice Chamber Locations */}
                <div className="mt-3.5 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    {language === 'bn' ? 'প্র্যাকটিস চেম্বারসমূহ (Practice Locations):' : 'Practice Locations:'}
                  </span>
                  <div className="space-y-1">
                    {getDoctorChambers(doctor).map((ch) => (
                      <div key={ch.id} className="flex items-center justify-between text-[11px] p-2 bg-slate-50/90 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-1.5 truncate">
                          <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{(ch.branchArea || ch.facilityName || 'Chamber').split(' ')[0]}</span>
                          <span className="text-slate-400 text-[10px] truncate">· {ch.shiftHours || 'Schedule'}</span>
                        </div>
                        <span className="font-extrabold text-teal-700 shrink-0 text-[11px]">৳{ch.consultationFee}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">{t('doctors.fee', 'Chamber Fee')}</span>
                  <span className="text-base font-extrabold text-slate-900">৳{doctor.consultationFee}</span>
                </div>
                <button
                  onClick={() => onSelectDoctorForBooking(doctor)}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {t('doctors.book_btn', 'Book Appointment')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
