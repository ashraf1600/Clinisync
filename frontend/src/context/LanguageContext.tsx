import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'bn';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.specialists': 'Specialists',
    'nav.book': 'Book Visit',
    'nav.doctors_book': 'Find Doctor & Book',
    'nav.live_tracker': 'Live Token Tracker',
    'nav.my_bookings': 'My Bookings & Pass',
    'nav.chamber': 'Doctor Chamber',
    'nav.slots': 'Slot Generator',
    'nav.admin': 'Admin Portal',
    'nav.onboarding': 'Doctor Onboarding',
    'nav.login': 'Login',
    'nav.logout': 'Log Out',

    // Doctors Page
    'doctors.hero_badge': 'Official Specialist Panel',
    'doctors.hero_title': 'Find & Consult Trusted Specialists',
    'doctors.hero_desc': 'Live queue token tracking, transparent chamber fees, and zero double-booking guarantee.',
    'doctors.search_placeholder': 'Search by doctor name, specialty, or hospital...',
    'doctors.fee': 'Fee',
    'doctors.experience': 'yrs exp',
    'doctors.book_btn': 'Book Serial',
    'doctors.no_found': 'No specialists found matching your search.',

    // Specialties
    'spec.All': 'All',
    'spec.Cardiology': 'Cardiology',
    'spec.Neurology': 'Neurology',
    'spec.Pediatrics': 'Pediatrics',
    'spec.Orthopedics': 'Orthopedics',
    'spec.Gynecology': 'Gynecology',
    'spec.Dermatology': 'Dermatology',
    'spec.General Medicine': 'General Medicine',

    // Booking Page
    'book.title': 'Reserve Chamber Appointment',
    'book.subtitle': 'Instant token assignment · Zero advance payment required',
    'book.select_specialist': 'Change Specialist',
    'book.select_date': 'Select Calendar Date',
    'book.available_slots': 'Available Time Slots on',
    'book.slots_open': 'slots open',
    'book.no_slots': 'No available slots for this date. Please choose another date.',
    'book.visit_type': 'Visit Type',
    'book.type_new': 'New Consultation',
    'book.type_followup': 'Followup Visit',
    'book.chief_complaint': 'Chief Complaint / Symptoms',
    'book.chief_placeholder': 'e.g. Chest discomfort, fever, diabetes checkup...',
    'book.fee_notice': 'Estimated Fee (Pay at Chamber)',
    'book.zero_advance': 'Zero advance online payment required. Pay at doctor chamber.',
    'book.confirm_btn': 'Confirm Reservation',
    'book.processing': 'Assigning Token...',

    // Appointments Page
    'appts.title': 'My Chamber Tokens',
    'appts.subtitle': 'Active chamber serial numbers and past appointment history',
    'appts.tab_upcoming': 'Upcoming Visits',
    'appts.tab_past': 'Past History',
    'appts.no_upcoming': 'No upcoming appointments found.',
    'appts.pass_btn': 'Chamber Pass',
    'appts.cancel_btn': 'Cancel',
    'appts.pass_modal_badge': 'Official Chamber Pass',
    'appts.pass_serial': 'SERIAL',
    'appts.pass_slot_time': 'Scheduled Slot',
    'appts.pass_status': 'Status',
    'appts.pass_payment': 'Payment',
    'appts.pass_scan_title': 'SCAN AT CLINIC DESK',
    'appts.pass_scan_sub': 'Instant check-in token validator',
    'appts.guideline': 'Please arrive at the chamber reception 15 minutes before your scheduled slot.',
    'appts.print_btn': 'Print / Download Slip',

    // Booking Confirmation
    'book.confirmed_badge': 'Token Confirmed',
    'book.confirmed_title': 'Serial #',
    'book.confirmed_msg': 'Your reservation is confirmed with',
    'book.confirmed_doctor': 'Doctor:',
    'book.confirmed_schedule': 'Schedule:',
    'book.confirmed_payment': 'Payment:',
    'book.confirmed_pay_at_chamber': 'Pay At Chamber',
    'book.confirmed_guideline': 'No advance charge required. Please report to the reception desk 15 minutes prior to your serial call.',
    'book.confirmed_another_btn': 'Book Another Visit',
    'book.login_required': 'Authentication required: Please log in to reserve your appointment token.',
    'book.slot_conflict': '⚠️ This slot has just been reserved by another patient. Please choose another slot.',

    // Authentication
    'auth.login_title': 'Welcome Back',
    'auth.login_subtitle': 'Log in with your clinic credentials',
    'auth.register_title': 'Create Account',
    'auth.register_subtitle': 'Join ShebaSync for fast appointment bookings',
    'auth.role_select': 'Select Account Type / Role',
    'auth.role_patient': 'Patient',
    'auth.role_patient_desc': 'Book chamber visits',
    'auth.role_doctor': 'Doctor',
    'auth.role_doctor_desc': 'Manage live queue',
    'auth.role_admin': 'Admin',
    'auth.role_admin_desc': 'Clinic management',
    'auth.specialization': 'Medical Specialty',
    'auth.bmdc_number': 'BMDC Registration # (Optional)',
    'auth.fullname': 'Full Name',
    'auth.phone': 'Phone Number',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.login_btn': 'Login',
    'auth.register_btn': 'Create Account',
    'auth.processing': 'Processing...',
    'auth.already_account': 'Already have an account? Log In',
    'auth.need_account': "Don't have an account? Register",

    // Chamber Queue
    'chamber.title': 'Doctor Chamber & Live Queue',
    'chamber.subtitle': 'Real-time patient intake, 5-minute break invariant, and visit status management.',
    'chamber.status_label': 'CHAMBER STATUS',
    'chamber.status_active': 'ACTIVE (Consulting)',
    'chamber.status_break': 'EMPTY (BREAK)',
    'chamber.remaining': 'remaining',
    'chamber.break_invariant': 'Strict Invariant: Chamber is EMPTY (BREAK). All waiting patients alerted. No patient in queue is called until resumed.',
    'chamber.break_btn': 'Take 5-Min Break',
    'chamber.resume_btn': 'Resume Queue & Call In',
    'chamber.today_queue': "Today's Patient Queue",
    'chamber.completed_count': 'Completed',
    'chamber.col_serial': 'SERIAL #',
    'chamber.col_patient': 'PATIENT NAME',
    'chamber.col_type': 'VISIT TYPE',
    'chamber.col_complaint': 'CHIEF COMPLAINT',
    'chamber.col_slot': 'SCHEDULED SLOT',
    'chamber.col_status': 'STATUS',
    'chamber.col_action': 'CHAMBER ACTION',
    'chamber.action_complete': 'Complete Visit',
    'chamber.action_done': 'Consultation Done',

    // Statuses
    'token.serial': 'Serial #',
    'status.confirmed': 'CONFIRMED',
    'status.break': 'EMPTY (BREAK)',
    'status.in_chamber': 'IN CHAMBER',
    'status.completed': 'COMPLETED',
    'pay.chamber': 'PAY AT CHAMBER',
  },
  bn: {
    // Navigation
    'nav.specialists': 'বিশেষজ্ঞ চিকিৎসক',
    'nav.book': 'সিরিয়াল বুকিং',
    'nav.doctors_book': 'ডাক্তার খুঁজুন ও বুকিং',
    'nav.live_tracker': 'লাইভ সিরিয়াল ট্র্যাকার',
    'nav.my_bookings': 'আমার সিরিয়াল ও স্লিপ',
    'nav.chamber': 'ডাক্তার চেম্বার',
    'nav.slots': 'স্লট তৈরি',
    'nav.admin': 'অ্যাডমিন পোর্টাল',
    'nav.onboarding': 'ডাক্তার নিবন্ধন',
    'nav.login': 'লগইন',
    'nav.logout': 'লগআউট',

    // Doctors Page
    'doctors.hero_badge': 'অনুমোদিত বিশেষজ্ঞ প্যানেল',
    'doctors.hero_title': 'বিশ্বস্ত বিশেষজ্ঞ ডাক্তার খুঁজুন ও সিরিয়াল নিন',
    'doctors.hero_desc': 'রিয়েল-টাইম লাইভ সিরিয়াল ট্র্যাকিং, নিশ্চিত চেম্বার ফি এবং শতভাগ ডাবল-বুকিং মুক্ত সেবা।',
    'doctors.search_placeholder': 'ডাক্তারের নাম, স্পেশালিটি অথবা হাসপাতাল দিয়ে খুঁজুন...',
    'doctors.fee': 'ভিজিট ফি',
    'doctors.experience': 'বছরের অভিজ্ঞতা',
    'doctors.book_btn': 'সিরিয়াল নিন',
    'doctors.no_found': 'আপনার অনুসন্ধানের সাথে মিল রেখে কোনো ডাক্তার পাওয়া যায়নি।',

    // Specialties
    'spec.All': 'সকল বিভাগ',
    'spec.Cardiology': 'হৃদরোগ (Cardiology)',
    'spec.Neurology': 'নিউরোলজি (Neurology)',
    'spec.Pediatrics': 'শিশু রোগ (Pediatrics)',
    'spec.Orthopedics': 'হাড় ও জোড়া (Orthopedics)',
    'spec.Gynecology': 'স্ত্রী ও প্রসূতি (Gynecology)',
    'spec.Dermatology': 'চর্ম ও এলার্জি (Dermatology)',
    'spec.General Medicine': 'মেডিসিন (Medicine)',

    // Booking Page
    'book.title': 'চেম্বার অ্যাপয়েন্টমেন্ট সিরিয়াল বুকিং',
    'book.subtitle': 'তাত্ক্ষণিক সিরিয়াল টোকেন বরাদ্দ · অগ্রিম কোনো ফি প্রদানের প্রয়োজন নেই',
    'book.select_specialist': 'চিকিৎসক পরিবর্তন করুন',
    'book.select_date': 'সাক্ষাতের তারিখ নির্বাচন করুন',
    'book.available_slots': 'তারিখের খালি সময়সমূহ',
    'book.slots_open': 'টি স্লট খালি আছে',
    'book.no_slots': 'এই তারিখে কোনো খালি সময় পাওয়া যায়নি। অনুগ্রহ করে অন্য তারিখ নির্বাচন করুন।',
    'book.visit_type': 'সাক্ষাতের ধরন',
    'book.type_new': 'নতুন রোগী পরামর্শ (New Visit)',
    'book.type_followup': 'রিপোর্ট দেখানো / ফলো-আপ (Followup)',
    'book.chief_complaint': 'আপনার শারীরিক সমস্যা বা উপসর্গ লিখুন',
    'book.chief_placeholder': 'যেমন: জ্বর, বুকে চাপ লাগা, মাথা ঘোরা, ডায়াবেটিস পরীক্ষা...',
    'book.fee_notice': 'চেম্বারে প্রদেয় ফি (কোনো অগ্রিম টাকা লাগবে না)',
    'book.zero_advance': 'অনলাইনে কোনো অগ্রিম টাকা দিতে হবে না। চেম্বারে পৌঁছে সরাসরি রিসেপশনে ফি পরিশোধ করুন।',
    'book.confirm_btn': 'সিরিয়াল বুকিং নিশ্চিত করুন',
    'book.processing': 'সিরিয়াল টোকেন তৈরি হচ্ছে...',

    // Appointments Page
    'appts.title': 'আমার চেম্বার সিরিয়ালসমূহ',
    'appts.subtitle': 'আপনার সক্রিয় সিরিয়াল নম্বর এবং পূর্ববর্তী ভিজিটের ইতিহাস',
    'appts.tab_upcoming': 'আসন্ন সাক্ষাত',
    'appts.tab_past': 'পূর্ববর্তী ইতিহাস',
    'appts.no_upcoming': 'বর্তমানে কোনো সক্রিয় অ্যাপয়েন্টমেন্ট সিরিয়াল নেই।',
    'appts.pass_btn': 'চেম্বার স্লিপ',
    'appts.cancel_btn': 'বাতিল করুন',
    'appts.pass_modal_badge': 'অফিসিয়াল চেম্বার প্রবেশ পাস',
    'appts.pass_serial': 'সিরিয়াল নং',
    'appts.pass_slot_time': 'নির্ধারিত সময়',
    'appts.pass_status': 'অবস্থা',
    'appts.pass_payment': 'পেমেন্ট পদ্ধতি',
    'appts.pass_scan_title': 'চেম্বার ডেস্কে কিউআর স্ক্যান করুন',
    'appts.pass_scan_sub': 'রিসেপশনে তাৎক্ষণিক ভেরিফিকেশন কোড',
    'appts.guideline': 'অনুগ্রহ করে নির্ধারিত সময়ের ১৫ মিনিট পূর্বে চেম্বার অভ্যর্থনায় উপস্থিত থাকুন। ফি চেম্বারে সরাসরি পরিশোধযোগ্য।',
    'appts.print_btn': 'প্রিন্ট অথবা সেভ স্লিপ',

    // Booking Confirmation
    'book.confirmed_badge': 'টোকেন সিরিয়াল নিশ্চিত',
    'book.confirmed_title': 'সিরিয়াল নং #',
    'book.confirmed_msg': 'আপনার সিরিয়ালটি সফলভাবে নিশ্চিত হয়েছে:',
    'book.confirmed_doctor': 'চিকিৎসক:',
    'book.confirmed_schedule': 'সময়সূচী:',
    'book.confirmed_payment': 'পেমেন্ট:',
    'book.confirmed_pay_at_chamber': 'চেম্বারে সরাসরি প্রদেয়',
    'book.confirmed_guideline': 'কোনো অগ্রিম ফি লাগবেনা। আপনার সিরিয়ালের ১৫ মিনিট আগে সরাসরি চেম্বার অভ্যর্থনায় উপস্থিত থাকুন।',
    'book.confirmed_another_btn': 'আরেকটি সিরিয়াল বুকিং করুন',
    'book.login_required': 'সিরিয়াল বুকিং করার জন্য অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করুন।',
    'book.slot_conflict': '⚠️ এই সময়টি মাত্র অন্য একজন রোগী বুকিং করেছেন। অনুগ্রহ করে অন্য সময় বেছে নিন।',

    // Authentication
    'auth.login_title': 'লগইন করুন',
    'auth.login_subtitle': 'আপনার অ্যাকাউন্ট তথ্য দিয়ে ক্লিনিক পোর্টালে প্রবেশ করুন',
    'auth.register_title': 'নতুন অ্যাকাউন্ট তৈরি করুন',
    'auth.register_subtitle': 'সহজে ডাক্তারের সিরিয়াল বুকিং করতে নিবন্ধন করুন',
    'auth.role_select': 'অ্যাকাউন্টের ধরন / পদবি নির্বাচন করুন',
    'auth.role_patient': 'সাধারণ রোগী',
    'auth.role_patient_desc': 'সিরিয়াল বুকিং ও স্লিপ',
    'auth.role_doctor': 'চিকিৎসক / ডাক্তার',
    'auth.role_doctor_desc': 'চেম্বারের রোগী কিউ নিয়ন্ত্রণ',
    'auth.role_admin': 'ক্লিনিক অ্যাডমিন',
    'auth.role_admin_desc': 'পূর্ণ সিস্টেম ব্যবস্থাপনা',
    'auth.specialization': 'বিশেষজ্ঞ বিভাগ (Specialty)',
    'auth.bmdc_number': 'বিএমডিসি নম্বর (BMDC Reg No.)',
    'auth.fullname': 'আপনার পুরো নাম',
    'auth.phone': 'মোবাইল নম্বর',
    'auth.email': 'ইমেইল অ্যাড্রেস',
    'auth.password': 'পাসওয়ার্ড',
    'auth.login_btn': 'লগইন করুন',
    'auth.register_btn': 'নিবন্ধন সম্পন্ন করুন',
    'auth.processing': 'প্রসেসিং হচ্ছে...',
    'auth.already_account': 'ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন',
    'auth.need_account': 'নতুন অ্যাকাউন্ট নেই? নিবন্ধন করুন',

    // Chamber Queue
    'chamber.title': 'ডাক্তার চেম্বার ও লাইভ সিরিয়াল কিউ',
    'chamber.subtitle': 'রিয়েল-টাইম রোগী আগমন, ৫ মিনিটের ক্লিনিক্যাল বিরতি এবং সিরিয়াল ব্যবস্থাপনা।',
    'chamber.status_label': 'চেম্বারের অবস্থা',
    'chamber.status_active': 'রোগী দেখা চলছে (ACTIVE)',
    'chamber.status_break': 'ডাক্তার সাহেব বিরতিতে আছেন (BREAK)',
    'chamber.remaining': 'বাকি আছে',
    'chamber.break_invariant': 'কঠোর নিয়ম: ডাক্তার বিরতিতে আছেন। অপেক্ষমাণ সকল রোগীকে সতর্ক করা হয়েছে। পুনরায় চালু না করা পর্যন্ত রোগী প্রবেশ নিষেধ।',
    'chamber.break_btn': '৫ মিনিটের বিরতি নিন',
    'chamber.resume_btn': 'বিরতি শেষ — কিউ চালু করুন',
    'chamber.today_queue': "আজকের রোগী সিরিয়াল তালিকা",
    'chamber.completed_count': 'দেখা সম্পন্ন',
    'chamber.col_serial': 'সিরিয়াল #',
    'chamber.col_patient': 'রোগীর নাম',
    'chamber.col_type': 'সাক্ষাতের ধরন',
    'chamber.col_complaint': 'রোগীর সমস্যা',
    'chamber.col_slot': 'সময়',
    'chamber.col_status': 'অবস্থা',
    'chamber.col_action': 'পদক্ষেপ',
    'chamber.action_complete': 'দেখা সম্পন্ন করুন',
    'chamber.action_done': 'পরামর্শ সম্পন্ন',

    // Statuses
    'token.serial': 'সিরিয়াল নং',
    'status.confirmed': 'নিশ্চিত',
    'status.break': 'বিরতি চলছে',
    'status.in_chamber': 'চেম্বারে আছেন',
    'status.completed': 'সম্পন্ন',
    'pay.chamber': 'চেম্বারে প্রদেয়',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Default to Bengali ('bn') for Bangladeshi audience as requested!
    return (localStorage.getItem('preferred_language') as Language) || 'bn';
  });

  useEffect(() => {
    localStorage.setItem('preferred_language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'bn' : 'en'));
  };

  const t = (key: string, defaultText?: string): string => {
    return translations[language][key] || defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
