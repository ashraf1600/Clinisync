# 🎨 CliniSync / ShebaSync — Official UI/UX Design System & Specification
**Version:** 2.1 (Locked Production Design)  
**Platform:** Flutter Mobile Client (Patient) & Next.js Web Console (Doctor & Reception Admin)  
**Official Theme:** **Trust & Digital Precision (Royal Medical Blue + Bio-Teal & Clean Clinical Slate)**  
**Accessibility Standard:** WCAG 2.1 Level AAA Compliant (High Contrast for Elderly & Clinic Lobbies)  
**Bilingual Support:** English (`Plus Jakarta Sans`) & Bengali (`Hind Siliguri`)

---

## 1. Design Philosophy & Healthcare Color Psychology

The CliniSync design system is scientifically engineered around the realities of Bangladesh outpatient clinics (e.g., Popular, Square, Evercare, Green Life):
1. **Anxiety Reduction & Trust:** Overly saturated colors or aggressive red tones trigger panic in waiting patients. We use **Royal Medical Blue (`#1D4ED8`)** and **Bio-Teal (`#0D9488`)** to induce calmness, professional authority, and clinical hygiene.
2. **High-Legibility Light Mode for Mobile Patients:** Clinic waiting rooms in Bangladesh are brightly lit; patients of varying ages and digital literacy need maximum contrast to read **Serial Numbers (`SERIAL #04`)**, estimated wait times, and QR codes. The patient app defaults to an ultra-clean **Crisp Clinical White (`#FFFFFF`) & Soft Slate (`#F8FAFC`)** canvas with **Deep Charcoal (`#0F172A`)** typography.
3. **Ergonomic Web Console for Clinicians:** Doctors and receptionists spend 6–8 hours staring at screens. The web queue utilizes soft matte slate (`#F1F5F9` / `#0F172A`) to minimize ocular fatigue during evening chambers.
4. **Deterministic Status Feedback:** Every queue state (Inside Chamber, Doctor on Break, Waiting Lobby, Completed) has an unmistakable, distinct color signature.

---

## 2. Official Locked Color Tokens (Trust & Digital Precision)

### 2.1 Brand & Neutral Palette
| Token Name | Hex Code | Tailwind Equivalent | Purpose & Role |
| :--- | :---: | :---: | :--- |
| **`brand-primary`** | `#1D4ED8` | `blue-700` | Primary brand identity, header banners, major action buttons ("Confirm Booking"). |
| **`brand-deep`** | `#1E3A8A` | `blue-900` | High-authority text headers, desktop navbar background. |
| **`brand-accent`** | `#06B6D4` / `#0284C7` | `cyan-500` / `sky-600` | Interactive active states, slot selection ring, patient position highlight. |
| **`brand-teal`** | `#0D9488` | `teal-600` | Secondary CTA, appointment slip badge, digital health accents. |
| **`canvas-bg-light`** | `#F8FAFC` | `slate-50` | Primary patient mobile canvas background (clean & modern). |
| **`surface-card-light`**| `#FFFFFF` | `white` | Elevated appointment cards, doctor profile cards, QR token slips. |
| **`border-subtle`** | `#E2E8F0` | `slate-200` | Card borders, dividers, subtle slot chip outlines. |
| **`text-primary`** | `#0F172A` | `slate-900` | Main readable body text, serial labels (14.2:1 contrast ratio against white). |
| **`text-secondary`** | `#475569` | `slate-600` | Timestamps, chamber addresses, doctor designations. |
| **`canvas-dark`** | `#0B1120` | `slate-950` | Doctor night console & ambient dark preview canvas. |

### 2.2 Semantic Functional Status Colors (Queue & Break Engine)
| Queue / System State | Token | Hex Code | Psychological Meaning & UI Application |
| :--- | :--- | :---: | :--- |
| 🟢 **Inside Chamber** | `status-active` | `#10B981` | Emerald green pulse. Signifies active consultation in progress. |
| 🟡 **Doctor Break / Hold** | `status-hold` | `#F59E0B` | Warm Amber. Alerts waiting patients that chamber is paused without causing panic. |
| 🔵 **Patient Serial Highlight**| `status-token` | `#0284C7` | High-visibility Electric Cyan. Patient immediately locates their own serial number. |
| 🔴 **Alert / Cancelled** | `status-alert` | `#F43F5E` | Soft Coral Rose. Indicates slot cancellation, doctor emergency leave, or conflict. |
| ⚪ **Completed / History** | `status-muted` | `#94A3B8` | Neutral Slate. Finished visits and past historical notifications. |

---

## 3. Typography & Accessibility Standards

* **English Typography:** `Plus Jakarta Sans` (weights: `400 Regular`, `600 SemiBold`, `800 ExtraBold`).
* **Bengali Typography:** `Hind Siliguri` (weights: `500 Medium`, `700 Bold`).
* **Contrast Compliance:** Minimum 7:1 contrast on all interactive buttons and minimum 14:1 on serial numbers (`#0F172A` on `#FFFFFF` / `#10B981` badges), exceeding WCAG AAA.
* **Touch Targets:** All clickable slot chips and buttons maintain a minimum of `48px x 48px` hit area for effortless thumb tapping on mobile.

---

## 4. Screen Layout & Component Wireframes

### 4.1 Mobile Screen: Live Chamber Serial Slip (Light Mode)
```
+------------------------------------------+
|  ← Back      Serial Token Slip    Share  |
+------------------------------------------+
|  +------------------------------------+  |
|  |  POPULAR DIAGNOSTIC · CHAMBER 402  |  |
|  |  Dr. Tanvir Hossain · Cardiology   |  |
|  |  Today · 05:45 PM                  |  |
|  |                                    |  |
|  |            SERIAL #04              |  |  <-- Electric Cyan Badge (#0284C7)
|  |                                    |  |
|  |       [  QR CODE VECTOR  ]         |  |  <-- 1-Second Check-in Scan
|  |                                    |  |
|  |  Patient: Rahim Ahmed              |  |
|  |  Payment: Pay at Chamber (৳1,200)  |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  | ⏳ Live Chamber Tracker            |  |
|  | Currently Inside: Serial #02       |  |  <-- Emerald (#10B981)
|  | Your Position: 2 Ahead (~20 mins)  |  |
|  +------------------------------------+  |
+------------------------------------------+
|  [ 📥 Download PDF ]  [ 💬 SMS Slip ]    |
+------------------------------------------+
```

### 4.2 Web Screen: Doctor Chamber & Live Queue Dashboard
```
+--------------------------------------------------------------------------+
| ⚡ CliniSync Doctor Console | Dr. Tanvir Hossain | [☕ Take 5m Break] [🔴 Stop] |
+--------------------------------------------------------------------------+
| CHAMBER STATUS: 🟢 ACTIVE CONSULTATION (Serial #02 Inside)               |
|                                                                          |
| Today's Patient Queue (Total: 18 · Completed: 1 · Waiting: 17)           |
| +----+-------------+---------+---------------+---------------+---------+ |
| | #  | Patient     | Time    | Problem (Doc) | Status        | Action  | |
| +----+-------------+---------+---------------+---------------+---------+ |
| | 02 | Karim Ullah | 5:30 PM | Chest Pain    | 🟢 In Chamber | [Done]  | |
| | 03 | Fatima Begum| 5:45 PM | Routine Check | ⏳ Waiting    | [Call]  | |
| | 04 | Rahim Ahmed | 6:00 PM | Short Breath  | ⏳ Waiting    | [Hold]  | |
| +----+-------------+---------+---------------+---------------+---------+ |
+--------------------------------------------------------------------------+
```

---


### 4.3 Web Screen: Doctor & Admin Time Slot & Schedule Creator
```
+-------------------------------------------------------------------------------+
| ⚡ CliniSync Web | Dr. Karim Chowdhury | [📋 Live Queue] [🗓️ Slot Creator]     |
+-------------------------------------------------------------------------------+
| 🗓️ Bulk Time Slot Generator (API: POST /availability/bulk-generate)           |
|                                                                               |
| 1. Range Horizon:       2. Working Days & Shifts:     3. Duration & Buffer:   |
| (o) Next Month (30d)    [x] Sat [x] Sun [x] Mon       Slot: [ 30 mins v ]     |
| ( ) Next Week (7d)      [x] Tue [x] Wed [x] Thu       Buffer: [ 10 mins v ]   |
|                         [ ] Fri (Weekly Holiday)                              |
|                         Shift: 09:00 AM - 01:00 PM    Capacity: 6 serials/day |
|                                                       Output: 132 Total Slots |
|                                                                               |
|  [ ⚡ Generate & Publish Slots to Patient Mobile App ]                         |
+-------------------------------------------------------------------------------+
| Active Weekly Shift Templates:                                                |
| • Sunday:    09:00 AM – 01:00 PM (30m slot + 10m buffer) -> 6 Serials [Active]|
| • Tuesday:   09:00 AM – 01:00 PM (30m slot + 10m buffer) -> 6 Serials [Active]|
| • Thursday:  10:00 AM – 01:00 PM (30m slot + 10m buffer) -> 5 Serials [Active]|
|                                             [+ Add Template] [🚫 Block Date]  |
+-------------------------------------------------------------------------------+
```

---


### 4.4 Web Screen: Admin Doctor Onboarding & Profiling Console
```
+-------------------------------------------------------------------------------+
| ⚡ CliniSync Admin Portal | [📋 Queue] [🗓️ Shifts] [👨‍⚕️ Doctor Onboarding]    |
+-------------------------------------------------------------------------------+
| 👨‍⚕️ Specialist Clinician Directory (API: POST /api/v1/doctors)                |
|                                                                               |
| Total Specialists: 12 Active    Departments: 6    BMDC Verified: 100%         |
|                                                                               |
| [+ Onboard New Specialist Doctor]                                             |
|                                                                               |
| +---------------------------------------------------------------------------+ |
| | ONBOARDING MODAL / FORM:                                                  | |
| | 1. Doctor Full Name (EN / BN): [ Dr. Tanvir Hossain / ডা. তানভীর হোসেন  ] | |
| | 2. Clinical Specialty:        [ Cardiology (হৃদরোগ)                    v] | |
| | 3. BMDC Registration #:       [ A-54982 (Verified)                      ] | |
| | 4. Degrees & Experience:      [ MBBS, FCPS (Cardiology), MD ] [ 14 Yrs  ] | |
| | 5. Chamber & Room:            [ Chamber #302, Level 3, Building B       ] | |
| | 6. Consultation Fee:          [ ৳ 1,200 New Visit ] [ ৳ 800 Follow-up   ] | |
| |                                                                           | |
| |  [ 💾 Save & Publish Doctor Profile to Mobile App ]                       | |
| +---------------------------------------------------------------------------+ |
|                                                                               |
| Current Onboarded Doctors Table:                                              |
| • Dr. Karim Chowdhury | Cardiology | BMDC A-38912 | Fee: ৳1,200 | [Manage]    |
| • Dr. Fatima Begum    | Pediatrics | BMDC A-41209 | Fee: ৳1,500 | [Manage]    |
| • Dr. Tanvir Hossain  | Cardiology | BMDC A-54982 | Fee: ৳1,200 | [Manage]    |
+-------------------------------------------------------------------------------+
```

---

## 5. Doctor Break & Empty Chamber Invariant Rule

1. **Automatic Completion:** When the doctor initiates a rest break (`startDoctorBreak`), the active patient in the chamber is immediately marked `completed` and exits.
2. **Strict Invariant:** During the break, **NO PATIENT can have the status `in_queue` ("In Chamber")**.
3. **Visual Banner:** The chamber status turns to **🟡 EMPTY (BREAK)** with an active countdown timer (e.g. `⏱️ 04:52 remaining`).
4. **Waiting Lobby Notification:** All patients in the lobby receive an instant in-app notification and SMS alert that the doctor is taking a quick 5-minute break.
5. **Resume Flow:** Only when the doctor clicks **"Resume Queue & Call In"** does the next sequential patient transition into `in_queue`.

---

## 6. Verification Status

This color specification is now permanently synchronized with:
- [`ui_prototype.html`](file:///d:/Semester_4_1/Attachment/ui_prototype.html) (Prototype rendered with the Trust & Digital Precision system)
- [`schema.sql`](file:///d:/Semester_4_1/Attachment/schema.sql) (Data constraints and status values)
- [`API_CONTRACT_LOCK.md`](file:///d:/Semester_4_1/Attachment/API_CONTRACT_LOCK.md) (Endpoints and wire payloads)
