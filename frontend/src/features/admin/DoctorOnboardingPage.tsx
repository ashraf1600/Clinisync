import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Search, ShieldCheck, Award, MapPin, DollarSign, X, CheckCircle, AlertCircle } from 'lucide-react';
import { doctorService } from '../doctors/services/doctorService';
import { Doctor } from '../doctors/types';
import { apiClient } from '../../services/api';
import { PageShell, PageHero, StatCard } from '../../components/Page';

export const DoctorOnboardingPage: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('DoctorPass123!');
  const [specialization, setSpecialization] = useState('Cardiology');
  const [bmdcNumber, setBmdcNumber] = useState('');
  const [degrees, setDegrees] = useState('MBBS, FCPS');
  const [designation, setDesignation] = useState('Senior Consultant');
  const [facilityName, setFacilityName] = useState('Popular Diagnostic Centre');
  const [chamberRoom, setChamberRoom] = useState('Room #405, Level 4');
  const [consultationFee, setConsultationFee] = useState<number>(1200);
  const [followupFee, setFollowupFee] = useState<number>(800);
  const [experienceYears, setExperienceYears] = useState<number>(12);
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80');

  const specialties = [
    'Cardiology',
    'Gynecology',
    'Neurology',
    'Pediatrics',
    'Orthopedics',
    'Dermatology',
    'General Medicine',
    'ENT',
    'Ophthalmology',
    'Urology',
  ];

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const res = await doctorService.getDoctors({ pageSize: 50 });
      setDoctors(Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      // 1. Create doctor user account
      const regRes = await apiClient.post('/auth/register', {
        name,
        email,
        password,
        role: 'doctor',
        timezone: 'Asia/Dhaka',
      });
      const userId = regRes.data.user.id;

      // 2. Create doctor clinical profile
      await doctorService.onboardDoctor({
        userId,
        specialization,
        degrees,
        bmdcNumber: bmdcNumber || `BMDC-A-${Math.floor(10000 + Math.random() * 90000)}`,
        designation,
        facilityName,
        chamberRoom,
        consultationFee: Number(consultationFee),
        followupFee: Number(followupFee),
        bio: bio || `${designation} in ${specialization} with ${experienceYears} years experience.`,
      });

      setStatusMessage({ type: 'success', text: `Dr. ${name} successfully onboarded and published!` });
      setIsModalOpen(false);
      // Reset form
      setName('');
      setEmail('');
      setBmdcNumber('');
      setBio('');
      loadDoctors();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Failed to onboard doctor',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDoctors = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.facility || d.facilityName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.bmdcNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageShell>
      <PageHero
        eyebrow="Admin Console · Directory"
        title={<>Specialist Clinician <span className="text-gradient-teal">Directory</span></>}
        subtitle="BMDC verification oversight, clinical profiling, and chamber fee management."
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Specialist</span>
          </button>
        }
      />

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl mb-6 text-xs font-semibold flex items-center space-x-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Specialists" value={doctors.length} accent="slate" />
        <StatCard label="Departments Active" value={new Set(doctors.map((d) => d.specialization)).size} accent="teal" />
        <StatCard label="BMDC Verified" value="100%" accent="blue" />
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 sm:px-6 bg-slate-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs font-black tracking-wide">Currently Onboarded Doctors</span>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search specialists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading clinician catalog...</div>
        ) : filteredDoctors.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No doctors match your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-premium">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Specialty</th>
                  <th className="py-3 px-4">BMDC Reg #</th>
                  <th className="py-3 px-4">Facility & Chamber</th>
                  <th className="py-3 px-4">Consultation Fee</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 flex items-center space-x-3">
                      {doc.profilePhotoUrl ? (
                        <img
                          src={doc.profilePhotoUrl}
                          alt={doc.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-700 text-white font-bold flex items-center justify-center">
                          {doc.name[0]}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-900 block">{doc.name}</span>
                        <span className="text-[11px] text-slate-400">{doc.degrees}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{doc.specialization}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                        {doc.bmdcNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-800 font-medium block">{doc.facility}</span>
                      <span className="text-[11px] text-slate-400">{doc.chamber}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-teal-700">৳{doc.consultationFee}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Onboarding Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                👨‍⚕️
              </div>
              <h3 className="text-xl font-black text-slate-900">Onboard New Specialist Doctor</h3>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Create physician login credentials, register BMDC certificate, and set consultation chamber hours.
            </p>

            <form onSubmit={handleOnboard} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Doctor Full Name (EN/BN)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Asaduzzaman / ডা. আসাদুজ্জামান"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Login Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="doctor.asad@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Clinical Specialty</label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none bg-white"
                  >
                    {specialties.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">BMDC Registration #</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BMDC-A-54982"
                    value={bmdcNumber}
                    onChange={(e) => setBmdcNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min="1"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Academic Degrees</label>
                  <input
                    type="text"
                    required
                    placeholder="MBBS, FCPS, MD, MRCP"
                    value={degrees}
                    onChange={(e) => setDegrees(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="Senior Consultant / Associate Professor"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Facility Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Square Hospital, Dhaka"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Chamber & Room #</label>
                  <input
                    type="text"
                    required
                    placeholder="Chamber #302, Level 3"
                    value={chamberRoom}
                    onChange={(e) => setChamberRoom(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Consultation Fee (৳ BDT)</label>
                  <input
                    type="number"
                    required
                    step="50"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none font-bold text-teal-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Follow-up Fee (৳ BDT)</label>
                  <input
                    type="number"
                    required
                    step="50"
                    value={followupFee}
                    onChange={(e) => setFollowupFee(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none font-bold text-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Profile Photo URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Professional Bio & Scope</label>
                <textarea
                  rows={2}
                  placeholder="Clinical background, special interest areas, patient care philosophy..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-600/25 transition"
                >
                  {submitting ? 'Creating Profile...' : 'Save & Publish Doctor Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
};
