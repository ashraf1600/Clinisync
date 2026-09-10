import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, Shield, Stethoscope, HeartPulse, Check, Sparkles, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type UserRole = 'patient' | 'doctor' | 'admin';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const { t, language } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);
  
  // Registration fields
  const [selectedRole, setSelectedRole] = useState<UserRole>('patient');
  const [name, setName] = useState('Rahim Ahmed');
  const [email, setEmail] = useState('rahim@example.com');
  const [password, setPassword] = useState('PatientPass123!');
  const [confirmPassword, setConfirmPassword] = useState('PatientPass123!');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('+880 1711-987654');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [bmdcNumber, setBmdcNumber] = useState('BMDC-A98421');
  const [adminInviteCode, setAdminInviteCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidBdPhone = (v: string) => !v || /^\+880\s?1[3-9]\d{2}-?\d{6}$/.test(v.trim());
  const passwordScore = () => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  };

  if (!isOpen) return null;

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'doctor') {
      setName('Dr. Tariqul Islam');
      setEmail(`dr.tariqul_${Math.floor(Math.random() * 900 + 100)}@example.com`);
      setPassword('DoctorPass123!');
      setPhone('+880 1819-234567');
    } else if (role === 'admin') {
      setName('Clinic Administrator');
      setEmail(`admin_${Math.floor(Math.random() * 900 + 100)}@clinisync.com`);
      setPassword('AdminSecret123!');
      setPhone('+880 1912-345678');
    } else {
      setName('Rahim Ahmed');
      setEmail(`patient_${Math.floor(Math.random() * 900 + 100)}@example.com`);
      setPassword('PatientPass123!');
      setPhone('+880 1711-987654');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isRegister) {
      if (!name.trim() || name.trim().length < 2) { setError(language === 'bn' ? 'নাম অন্তত ২ অক্ষরের হতে হবে' : 'Name must be at least 2 characters'); return; }
      if (!isValidBdPhone(phone)) { setError(language === 'bn' ? 'ফোন ফরম্যাট: +880 1711-XXXXXX' : 'Phone format: +880 1711-XXXXXX'); return; }
      if (password !== confirmPassword) { setError(language === 'bn' ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match'); return; }
      if (passwordScore() < 3) { setError(language === 'bn' ? 'পাসওয়ার্ড দুর্বল — বড়/ছোট অক্ষর ও সংখ্যা দিন (৮+)' : 'Password too weak — needs upper, lower and number (8+)'); return; }
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
          role: selectedRole,
          specialization: selectedRole === 'doctor' ? specialization : undefined,
          bmdcNumber: selectedRole === 'doctor' ? bmdcNumber : undefined,
          adminInviteCode: selectedRole === 'admin' ? adminInviteCode || undefined : undefined,
        } as any);
      } else {
        await login(email.trim(), password);
      }
      onClose();
    } catch (err: any) {
      const raw = err.response?.data;
      const msg = raw?.error?.message || raw?.detail || err.message || 'Authentication failed';
      // 429/403 rate limit friendly
      if (err.response?.status === 403 && raw?.error?.code === 'FORBIDDEN') {
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            {isRegister ? <Sparkles className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {isRegister ? t('auth.register_title', 'Create Account') : t('auth.login_title', 'Welcome Back')}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isRegister
                ? t('auth.register_subtitle', 'Join ShebaSync for fast appointment bookings')
                : t('auth.login_subtitle', 'Log in with your clinic credentials')}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-semibold flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Registration Role Selection Segment */}
          {isRegister && (
            <div className="space-y-2">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                {t('auth.role_select', 'Select Account Type / Role')} <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                {/* Patient Role */}
                <button
                  type="button"
                  onClick={() => handleRoleChange('patient')}
                  className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                    selectedRole === 'patient'
                      ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-600/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                      <HeartPulse className="w-4 h-4" />
                    </div>
                    {selectedRole === 'patient' && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-xs text-slate-900">{t('auth.role_patient', 'Patient')}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t('auth.role_patient_desc', 'Book visits')}</div>
                </button>

                {/* Doctor Role */}
                <button
                  type="button"
                  onClick={() => handleRoleChange('doctor')}
                  className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                    selectedRole === 'doctor'
                      ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-600/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    {selectedRole === 'doctor' && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-xs text-slate-900">{t('auth.role_doctor', 'Doctor')}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t('auth.role_doctor_desc', 'Manage queue')}</div>
                </button>

                {/* Admin Role */}
                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-600/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    {selectedRole === 'admin' && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-xs text-slate-900">{t('auth.role_admin', 'Admin')}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t('auth.role_admin_desc', 'Full clinic')}</div>
                </button>
              </div>
            </div>
          )}

          {/* Registration Extra Fields: Name & Phone */}
          {isRegister && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('auth.fullname', 'Full Name')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                    placeholder="e.g. Rahim Ahmed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('auth.phone', 'Phone Number')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 transition ${phone && !isValidBdPhone(phone) ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/30'}`}
                    placeholder="+880 1711-XXXXXX"
                  />
                </div>
                {phone && !isValidBdPhone(phone) && (
                  <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{language === 'bn' ? 'ফোন ফরম্যাট: +880 1711-XXXXXX' : 'Format: +880 1711-XXXXXX'}</p>
                )}
              </div>
            </div>
          )}

          {/* Doctor-Specific Fields */}
          {isRegister && selectedRole === 'doctor' && (
            <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-blue-950 mb-1">
                  {t('auth.specialization', 'Medical Specialty')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-blue-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="General Medicine">General Medicine (মেডিসিন)</option>
                  <option value="Cardiology">Cardiology (হৃদরোগ)</option>
                  <option value="Neurology">Neurology (নিউরোলজি)</option>
                  <option value="Pediatrics">Pediatrics (শিশু রোগ)</option>
                  <option value="Orthopedics">Orthopedics (হাড় ও জোড়া)</option>
                  <option value="Gynecology">Gynecology (স্ত্রী ও প্রসূতি)</option>
                  <option value="Dermatology">Dermatology (চর্ম ও এলার্জি)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-950 mb-1">
                  {t('auth.bmdc_number', 'BMDC Reg No.')}
                </label>
                <input
                  type="text"
                  value={bmdcNumber}
                  onChange={(e) => setBmdcNumber(e.target.value)}
                  placeholder="e.g. BMDC-A98421"
                  className="w-full p-2.5 rounded-xl border border-blue-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {/* Common Email Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {t('auth.email', 'Email Address')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                placeholder="name@example.com"
              />
            </div>
          </div>

          {/* Common Password Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {t('auth.password', 'Password')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isRegister && password && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
                  {[1,2,3,4].map(i => (
                    <span key={i} className={`flex-1 ${passwordScore() >= i ? (passwordScore() >= 4 ? 'bg-emerald-500' : passwordScore() >= 3 ? 'bg-amber-500' : 'bg-red-500') : 'bg-transparent'}`} />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-500">{passwordScore() >= 4 ? (language === 'bn' ? 'শক্তিশালী' : 'Strong') : passwordScore() >= 3 ? (language === 'bn' ? 'মাঝারি' : 'Medium') : (language === 'bn' ? 'দুর্বল' : 'Weak')}</span>
              </div>
            )}
            {isRegister && (
              <p className="text-[10px] text-slate-400 mt-1">{language === 'bn' ? '৮+ অক্ষর, বড়/ছোট অক্ষর ও সংখ্যা আবশ্যক' : '8+ chars, needs upper, lower and number'}</p>
            )}
          </div>
          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 transition ${confirmPassword && confirmPassword !== password ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/30'}`}
                  placeholder="••••••••"
                />
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{language === 'bn' ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match'}</p>
              )}
            </div>
          )}
          {isRegister && selectedRole === 'admin' && (
            <div>
              <label className="block text-[11px] font-bold text-purple-900 mb-1">
                {language === 'bn' ? 'অ্যাডমিন ইনভাইট কোড' : 'Admin Invite Code'} <span className="text-slate-400 text-[10px]">({language === 'bn' ? 'প্রয়োজন হলে' : 'if required'})</span>
              </label>
              <input
                type="text"
                value={adminInviteCode}
                onChange={(e) => setAdminInviteCode(e.target.value)}
                placeholder={language === 'bn' ? 'ক্লিনিক থেকে দেওয়া কোড লিখুন' : 'Enter clinic invite code'}
                className="w-full p-2.5 rounded-xl border border-purple-200 text-xs font-semibold text-slate-800 bg-purple-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">{language === 'bn' ? 'অ্যাডমিন অ্যাকাউন্ট শুধু ক্লিনিকের অনুমতিতে খোলা যায়।' : 'Admin accounts require a clinic invite code.'}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-700 to-teal-600 hover:from-blue-800 hover:to-teal-700 text-white rounded-2xl font-black text-xs tracking-wide shadow-lg shadow-blue-700/20 mt-2 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>{t('auth.processing', 'Processing...')}</span>
              </span>
            ) : isRegister ? (
              t('auth.register_btn', 'Create Account')
            ) : (
              t('auth.login_btn', 'Login')
            )}
          </button>
        </form>

        {/* Toggle Login / Register */}
        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-blue-700 hover:text-blue-800 font-bold hover:underline transition cursor-pointer"
          >
            {isRegister ? t('auth.already_account', 'Already have an account? Log In') : t('auth.need_account', "Don't have an account? Register")}
          </button>
        </div>
      </div>
    </div>
  );
};
