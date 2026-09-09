import React, { useEffect, useState } from 'react';
import { X, Camera, Plus, Save, Trash2, User as UserIcon, Building2, Stethoscope, Phone, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { doctorService } from '../../doctors/services/doctorService';
import { apiClient } from '../../../services/api';
import { Doctor, DoctorChamberLocation } from '../../doctors/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyLocation = (): DoctorChamberLocation => ({
  id: crypto.randomUUID(),
  facilityName: '',
  branchArea: '',
  chamberRoom: '',
  scheduleDays: '',
  shiftHours: '',
  consultationFee: 1200,
  followupFee: 800,
  contactPhone: '',
  address: '',
});

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserData } = useAuth();
  const { t } = useLanguage();

  // Common user fields
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');

  // Doctor-specific fields
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [locations, setLocations] = useState<DoctorChamberLocation[]>([]);
  const [activeDoctorTab, setActiveDoctorTab] = useState<'info' | 'chambers'>('info');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setUserName(user.name || '');
      setUserPhone(user.phone || '');
      setStatusMessage(null);

      if (user.role === 'doctor') {
        setLoading(true);
        doctorService.getMyProfile()
          .then((data) => {
            if (data) {
              setDoctorProfile(data);
              setLocations(data.locations && data.locations.length > 0 ? data.locations : [emptyLocation()]);
            }
          })
          .catch((err) => {
            console.error('Failed to load doctor profile', err);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const updateDoctorField = (field: keyof Doctor, value: string | number) => {
    if (!doctorProfile) return;
    setDoctorProfile({ ...doctorProfile, [field]: value });
  };

  const updateLocation = (index: number, field: keyof DoctorChamberLocation, value: string) => {
    setLocations(locations.map((loc, idx) => idx === index ? { ...loc, [field]: value } : loc));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const updated = await doctorService.uploadMyPhoto(file);
      setDoctorProfile(updated);
      setStatusMessage({ text: 'Profile photo updated successfully!', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: err.response?.data?.error?.message || 'Failed to upload photo.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      if (user.role === 'doctor' && doctorProfile) {
        const updated = await doctorService.updateMyProfile({
          name: doctorProfile.name,
          specialization: doctorProfile.specialization,
          degrees: doctorProfile.degrees,
          bmdcNumber: doctorProfile.bmdcNumber,
          designation: doctorProfile.designation,
          bio: doctorProfile.bio,
          experienceYears: doctorProfile.experienceYears,
          consultationFee: doctorProfile.consultationFee,
          followupFee: doctorProfile.followupFee,
          locations: locations.map(({ id, scheduleDays, shiftHours, consultationFee, followupFee, ...loc }) => loc),
        });
        setDoctorProfile(updated);
        setLocations(updated.locations || locations);
        updateUserData({ name: updated.name });
        setStatusMessage({ text: 'Doctor profile and chambers updated successfully!', type: 'success' });
      } else {
        // Patient / Admin user update
        const res = await apiClient.put('/users/me', {
          name: userName,
          phone: userPhone,
        });
        updateUserData({ name: res.data.name, phone: res.data.phone });
        setStatusMessage({ text: 'Profile updated successfully!', type: 'success' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.response?.data?.error?.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center font-bold text-white shadow-md">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{t('profile.title', 'Update Profile')}</h2>
              <p className="text-xs text-slate-400 capitalize">{user.role} Account • {user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Doctor Tab Selector */}
        {user.role === 'doctor' && (
          <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 space-x-2">
            <button
              type="button"
              onClick={() => setActiveDoctorTab('info')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition ${
                activeDoctorTab === 'info'
                  ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Personal & Medical Info</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDoctorTab('chambers')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition ${
                activeDoctorTab === 'chambers'
                  ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Chamber Locations ({locations.length})</span>
            </button>
          </div>
        )}

        {/* Body Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center space-x-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading your profile details...</div>
          ) : user.role === 'doctor' && doctorProfile ? (
            <>
              {activeDoctorTab === 'info' && (
                <div className="space-y-4">
                  {/* Photo & Basic header */}
                  <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="relative shrink-0">
                      {doctorProfile.profilePhotoUrl ? (
                        <img
                          src={doctorProfile.profilePhotoUrl}
                          alt={doctorProfile.name}
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-blue-700 text-white flex items-center justify-center text-2xl font-black shadow-sm">
                          {doctorProfile.name ? doctorProfile.name[0] : 'Dr'}
                        </div>
                      )}
                      <label
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center cursor-pointer shadow hover:bg-teal-500 transition"
                        title="Upload profile photo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{doctorProfile.name}</p>
                      <p className="text-[11px] text-teal-700 font-semibold">{doctorProfile.specialization || 'Specialist'}</p>
                      <p className="text-[10px] text-slate-400">Click camera icon to change profile picture</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Doctor Name</label>
                      <input
                        type="text"
                        value={doctorProfile.name || ''}
                        onChange={(e) => updateDoctorField('name', e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Specialization</label>
                      <input
                        type="text"
                        value={doctorProfile.specialization || ''}
                        onChange={(e) => updateDoctorField('specialization', e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">BMDC Registration</label>
                      <input
                        type="text"
                        value={doctorProfile.bmdcNumber || ''}
                        onChange={(e) => updateDoctorField('bmdcNumber', e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Designation</label>
                      <input
                        type="text"
                        value={doctorProfile.designation || ''}
                        onChange={(e) => updateDoctorField('designation', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Degrees & Qualifications</label>
                      <input
                        type="text"
                        value={doctorProfile.degrees || ''}
                        onChange={(e) => updateDoctorField('degrees', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Experience (Years)</label>
                      <input
                        type="number"
                        value={doctorProfile.experienceYears || 0}
                        onChange={(e) => updateDoctorField('experienceYears', Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Professional Bio & About</label>
                    <textarea
                      value={doctorProfile.bio || ''}
                      onChange={(e) => updateDoctorField('bio', e.target.value)}
                      rows={3}
                      placeholder="Brief overview of clinical expertise and patient care background..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {activeDoctorTab === 'chambers' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Hospital & Clinic Chambers ({locations.length})</p>
                      <p className="text-[11px] text-slate-500">Add, update, or remove your consultation chambers.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocations([...locations, emptyLocation()])}
                      className="inline-flex items-center space-x-1 text-xs font-bold text-blue-700 hover:text-white hover:bg-blue-700 bg-white px-3 py-1.5 rounded-xl border border-blue-200 transition shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Hospital Chamber</span>
                    </button>
                  </div>

                  {locations.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                      <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">No Chamber Locations Added</p>
                        <p className="text-[11px] text-slate-500">Add at least one hospital or clinic chamber for patient bookings.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocations([emptyLocation()])}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-xl shadow cursor-pointer transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Chamber Location</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {locations.map((loc, idx) => (
                        <div key={loc.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 relative space-y-3">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                            <span className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Chamber {idx + 1}: {loc.facilityName || 'New Facility'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLocations(locations.filter((_, i) => i !== idx));
                                setStatusMessage({ text: `Removed chamber "${loc.facilityName || 'New Chamber'}". Click Save to finalize.`, type: 'success' });
                              }}
                              className="inline-flex items-center space-x-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-xl transition cursor-pointer border border-red-200"
                              title="Delete chamber location"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove Chamber</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Hospital / Facility Name *</label>
                              <input
                                type="text"
                                value={loc.facilityName || ''}
                                onChange={(e) => updateLocation(idx, 'facilityName', e.target.value)}
                                placeholder="e.g. Evercare Hospital"
                                required
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Branch / Area</label>
                              <input
                                type="text"
                                value={loc.branchArea || ''}
                                onChange={(e) => updateLocation(idx, 'branchArea', e.target.value)}
                                placeholder="e.g. Bashundhara / Dhanmondi"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Chamber / Room *</label>
                              <input
                                type="text"
                                value={loc.chamberRoom || ''}
                                onChange={(e) => updateLocation(idx, 'chamberRoom', e.target.value)}
                                placeholder="e.g. Room 402, 4th Floor"
                                required
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Chamber Contact Phone</label>
                              <input
                                type="text"
                                value={loc.contactPhone || ''}
                                onChange={(e) => updateLocation(idx, 'contactPhone', e.target.value)}
                                placeholder="e.g. +8801700000000"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Address Details</label>
                              <input
                                type="text"
                                value={loc.address || ''}
                                onChange={(e) => updateLocation(idx, 'address', e.target.value)}
                                placeholder="e.g. Plot 81, Block E, Bashundhara R/A, Dhaka"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Patient / Admin Profile Edit Form */
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-lg font-black shadow-sm">
                  {userName ? userName[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">{userName || 'User Profile'}</h4>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+8801700000000"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Email address cannot be changed.</span>
              </div>
            </div>
          )}

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
