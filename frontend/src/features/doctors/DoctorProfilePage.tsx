import React, { useEffect, useState } from 'react';
import { Camera, Plus, Save, Trash2, Clock } from 'lucide-react';
import { doctorService } from './services/doctorService';
import { Doctor, DoctorChamberLocation } from './types';
import { getDoctorPhotoUrl } from './utils/chamberUtils';

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

export const DoctorProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Doctor | null>(null);
  const [locations, setLocations] = useState<DoctorChamberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    doctorService.getMyProfile().then((data) => {
      setProfile(data);
      setLocations(data.locations?.length ? data.locations : [emptyLocation()]);
    }).catch(() => setMessage('Unable to load your doctor profile.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto p-10 text-sm text-slate-500">Loading profile...</div>;
  if (!profile) return <div className="max-w-4xl mx-auto p-10 text-sm text-red-600">{message}</div>;

  const updateField = (field: keyof Doctor, value: string | number) => {
    setProfile({ ...profile, [field]: value });
  };

  const updateLocation = (index: number, field: keyof DoctorChamberLocation, value: string) => {
    setLocations(locations.map((location, locationIndex) => locationIndex === index ? { ...location, [field]: value } : location));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const updated = await doctorService.updateMyProfile({
        name: profile.name,
        specialization: profile.specialization,
        degrees: profile.degrees,
        bmdcNumber: profile.bmdcNumber,
        designation: profile.designation,
        bio: profile.bio,
        experienceYears: profile.experienceYears,
        consultationFee: profile.consultationFee,
        followupFee: profile.followupFee,
        locations: locations.map(({ id, scheduleDays, shiftHours, consultationFee, followupFee, ...location }) => location),
      });
      setProfile(updated);
      setLocations(updated.locations || locations);
      setMessage('Profile updated successfully.');
    } catch (error: any) {
      setMessage(error.response?.data?.error?.message || 'Profile update failed.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const updated = await doctorService.uploadMyPhoto(file);
      setProfile(updated);
      setMessage('Profile photo updated.');
    } catch (error: any) {
      setMessage(error.response?.data?.error?.message || 'Photo upload failed.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <form onSubmit={save} className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row gap-5 items-start">
          <div className="relative">
            {profile.profilePhotoUrl ? <img src={getDoctorPhotoUrl(profile.profilePhotoUrl) || profile.profilePhotoUrl} alt={profile.name} className="w-24 h-24 rounded-2xl object-cover border border-slate-200" /> : <div className="w-24 h-24 rounded-2xl bg-blue-700 text-white flex items-center justify-center text-3xl font-black">{profile.name[0]}</div>}
            <label className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center cursor-pointer shadow" title="Upload profile photo">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" />
            </label>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700">Doctor Profile</p>
            <h1 className="text-2xl font-black text-slate-900">{profile.name}</h1>
            <p className="text-sm text-slate-500">Manage your public clinical information and every hospital chamber.</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-black text-slate-900 mb-4">Professional information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([['name', 'Full name'], ['specialization', 'Specialization'], ['degrees', 'Degrees'], ['bmdcNumber', 'BMDC registration'], ['designation', 'Designation'], ['experienceYears', 'Experience years']] as const).map(([field, label]) => (
              <label key={field} className="text-xs font-bold text-slate-700">{label}
                <input value={profile[field] as string | number | undefined || ''} onChange={(event) => updateField(field, field === 'experienceYears' ? Number(event.target.value) : event.target.value)} className="mt-1 w-full p-3 rounded-xl border border-slate-200 font-normal outline-none focus:ring-2 focus:ring-blue-600" />
              </label>
            ))}
          </div>
          <label className="block mt-4 text-xs font-bold text-slate-700">Professional bio
            <textarea value={profile.bio || ''} onChange={(event) => updateField('bio', event.target.value)} rows={4} className="mt-1 w-full p-3 rounded-xl border border-slate-200 font-normal outline-none focus:ring-2 focus:ring-blue-600" />
          </label>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Hospitals and Chambers ({locations.length})</h2>
              <p className="text-xs text-slate-500">Add, edit, or remove your consultation locations.</p>
            </div>
            <button type="button" onClick={() => setLocations([...locations, emptyLocation()])} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 cursor-pointer">
              <Plus className="w-4 h-4" /> Add Chamber Location
            </button>
          </div>
          {locations.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-xs text-slate-500 mb-2">No chamber locations configured.</p>
              <button type="button" onClick={() => setLocations([emptyLocation()])} className="text-xs font-bold text-blue-700 underline">Add a chamber location</button>
            </div>
          ) : (
            <div className="space-y-4">
              {locations.map((location, index) => (
                <div key={location.id || index} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-slate-700">Chamber {index + 1}: {location.facilityName || 'New Chamber'}</span>
                    <div className="flex items-center gap-2">
                      <a
                        href="#schedule"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl transition border border-blue-200"
                        title="Configure slot times for this chamber"
                      >
                        <Clock className="w-3.5 h-3.5" /> Slot Times
                      </a>
                      <button type="button" onClick={() => setLocations(locations.filter((_, locationIndex) => locationIndex !== index))} className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-xl transition border border-red-200 cursor-pointer" title="Remove chamber">
                        <Trash2 className="w-3.5 h-3.5" /> Remove Chamber
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([['facilityName', 'Hospital / facility'], ['branchArea', 'Branch / area'], ['chamberRoom', 'Chamber / room'], ['address', 'Address'], ['contactPhone', 'Contact phone']] as const).map(([field, label]) => (
                      <label key={field} className="text-xs font-bold text-slate-700">{label}
                        <input value={location[field] || ''} onChange={(event) => updateLocation(index, field, event.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 font-normal bg-white outline-none focus:ring-1 focus:ring-blue-600" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-end gap-4"><span className="text-sm text-emerald-700">{message}</span><button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-bold disabled:opacity-60"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save profile'}</button></div>
      </form>
    </div>
  );
};
