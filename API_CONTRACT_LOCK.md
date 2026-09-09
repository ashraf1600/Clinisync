# 🔒 CliniSync / ShebaSync — Official API Contract Lock (v1.1.0)
**Document Status:** 🔒 FROZEN / BINDING CONTRACT  
**Target Teams:** Frontend Engineers (Next.js Web & Flutter Mobile) & Backend Engineers (FastAPI)  
**Effective Date:** 2026-09-07  
**Base Version:** `/api/v1`  
**Total Endpoints:** 27 Production Endpoints (Cataloged & Numbered)

---

## 1. Golden Rules & Architectural Invariants (Must Follow)

1. **Protocol & Wire Format:** All requests and responses use HTTPS with `Content-Type: application/json`.
2. **Naming Convention:**
   * **JSON Body Keys:** Strict `camelCase` (e.g., `doctorId`, `tokenNumber`, `chiefComplaint`, `paymentStatus`).
   * **URL Path & Query Params:** Strict `kebab-case` or `camelCase` as specified (e.g., `/api/v1/availability/{doctorId}/bulk-generate`).
   * **Database vs API Mapping:** Database internally stores `snake_case` (e.g., `token_number`). FastAPI automatically translates between `camelCase` <-> `snake_case` using Pydantic aliases (`populate_by_name=True`).
3. **Date & Time Standard:**
   * All timestamps must be ISO 8601 strings in **UTC** with trailing `Z`: `YYYY-MM-DDTHH:mm:ssZ` (e.g., `2026-09-10T10:00:00Z`).
   * Dates use `YYYY-MM-DD` (e.g., `2026-09-10`).
   * Times use 24-hour `HH:mm` (e.g., `14:30`).
4. **Zero Double-Booking Kernel Lock:**
   * Double-booking prevention is strictly enforced by PostgreSQL GiST exclusion constraint (`EXCLUDE USING GIST`).
   * Concurrent collision throws error code `23P01`, which FastAPI intercepts and maps to HTTP `409 Conflict` (`code: "SLOT_CONFLICT"`).
5. **Chamber Serial / Daily Token Generation:**
   * Every confirmed booking is auto-assigned a daily sequential integer `tokenNumber` (e.g., `1, 2, 3, 4...`).
   * Serial numbers are unique per doctor per calendar date.
6. **"No Advance Fee" Policy (`pay_at_chamber`):**
   * Online booking requires **no upfront credit card or payment gateway charge**.
   * `paymentStatus` defaults to `"pay_at_chamber"`. Patients pay at the chamber reception desk upon arrival.
7. **Doctor Break & Empty Chamber Invariant:**
   * When doctor initiates a break (`PUT .../queue-pause`), the currently active patient transitions to `"completed"` and leaves the chamber.
   * **Crucial Rule:** During the break, **NO PATIENT can have the status `in_queue` ("In Chamber")**.
   * Chamber status is strictly `EMPTY (BREAK)`. Patients in the waiting area are held until the doctor resumes (`PUT .../queue-resume`).
8. **Clinical Privacy & Data Masking (Bangladesh CSA / PDPA):**
   * Treating **Doctors** receive full clinical fields: `chiefComplaint`, `vitals`, `history`.
   * **Admins / Receptionists** receive operational and billing data only; sensitive health problems are automatically masked as `"🔒 Clinical Problem Masked"`.
9. **Idempotency Guard:**
   * Any state-creating or rescheduling mutations (`POST /api/v1/appointments/book`, `PUT /api/v1/appointments/{id}/reschedule`) **MUST** include an `Idempotency-Key` header containing a valid UUIDv4.
10. **Role-Based Access (JWT):**
    * Protected endpoints require `Authorization: Bearer <access_token>`.
    * Access Token lifetime: **15 minutes**.
    * Refresh Token lifetime: **7 days**.

---

## 2. Global Headers

| Header | Required On | Format / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `Content-Type` | All POST / PUT / PATCH | `application/json` | Enforces JSON payload. |
| `Accept` | All requests | `application/json` | Expected response. |
| `Authorization` | All secured routes | `Bearer eyJhbGciOi...` | Authentication & Role extraction. |
| `Idempotency-Key`| Booking & Rescheduling | `UUIDv4` (e.g. `e4b3c2d1-...`) | Guards against duplicate reservations / network retry storms. |

---

## 3. Standardized Response & Error Envelopes

### 3.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 85
  }
}
```

### 3.2 Standard Error Envelope (RFC 7807 Compliant)
```json
{
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "The selected appointment slot has just been booked. Please select another slot.",
    "status": 409,
    "details": {
      "doctorId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "conflictingRange": {
        "startTime": "2026-09-10T10:00:00Z",
        "endTime": "2026-09-10T10:30:00Z"
      }
    },
    "timestamp": "2026-09-07T12:00:00Z"
  }
}
```

### 3.3 Locked Error Code Reference
| HTTP Status | Error Code (`code`) | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Malformed body, missing required fields, or invalid syntax. |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired JWT token. |
| `403` | `FORBIDDEN` | Valid token, but user role is unauthorized for this resource. |
| `404` | `RESOURCE_NOT_FOUND` | Target doctor, patient, or appointment ID does not exist. |
| `409` | `SLOT_CONFLICT` | **PostgreSQL GiST exclusion violation.** Slot is occupied or overlapping. |
| `409` | `IDEMPOTENCY_IN_PROGRESS` | Previous identical request is currently processing. |
| `422` | `UNPROCESSABLE_ENTITY` | Pydantic schema rejection on field validation rules. |
| `429` | `RATE_LIMIT_EXCEEDED` | Exceeded 5 failed login attempts per 15 minutes. |
| `500` | `INTERNAL_SERVER_ERROR` | Unhandled backend exception. |

---

## 4. Complete Master API Endpoint Catalog (27 Endpoints)

---

### Module A: Authentication & Identity (`/api/v1/auth`)

#### 1. `POST /api/v1/auth/register`
* **Access:** Public
* **Purpose:** Register new Patient account.
* **Request Body:**
```json
{
  "name": "Rahim Ahmed",
  "email": "rahim@example.com",
  "password": "SecurePassword123!",
  "phone": "+880 1711-987654",
  "timezone": "Asia/Dhaka"
}
```
* **Response `201 Created`:**
```json
{
  "user": {
    "id": "7a35f0b4-82a1-408a-bfe0-3323c21a4f02",
    "name": "Rahim Ahmed",
    "email": "rahim@example.com",
    "role": "patient",
    "phone": "+880 1711-987654",
    "timezone": "Asia/Dhaka",
    "createdAt": "2026-09-07T12:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d8f921a4...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

#### 2. `POST /api/v1/auth/login`
* **Access:** Public (Rate limited: 5 attempts/15 min)
* **Purpose:** Authenticate Patient, Doctor, or Admin.
* **Request Body:**
```json
{
  "email": "doctor.karim@clinic.com",
  "password": "DoctorPass123!"
}
```
* **Response `200 OK`:** Returns user profile and access/refresh tokens.

#### 3. `POST /api/v1/auth/refresh`
* **Access:** Public
* **Purpose:** Renew expired 15-minute access token.
* **Request Body:** `{ "refreshToken": "d8f921a4..." }`
* **Response `200 OK`:** `{ "accessToken": "eyJhb...", "tokenType": "Bearer", "expiresIn": 900 }`

#### 4. `POST /api/v1/auth/forgot-password`
* **Access:** Public
* **Request Body:** `{ "email": "rahim@example.com" }`
* **Response `200 OK`:** `{ "message": "Password reset link sent if account exists." }`

#### 5. `POST /api/v1/auth/reset-password`
* **Access:** Public
* **Request Body:** `{ "token": "signed-token-xyz", "newPassword": "NewSecurePass123!" }`
* **Response `200 OK`:** `{ "message": "Password reset successfully." }`

---

### Module B: User Profiles (`/api/v1/users`)

#### 6. `GET /api/v1/users/me`
* **Access:** Authenticated (Patient, Doctor, Admin)
* **Response `200 OK`:** Returns currently authenticated user identity and role.

#### 7. `PUT /api/v1/users/me`
* **Access:** Authenticated (Patient, Doctor, Admin)
* **Request Body:** `{ "name": "Rahim Ahmed Chowdhury", "phone": "+880 1711-987654", "timezone": "Asia/Dhaka" }`
* **Response `200 OK`:** Returns updated user profile.

---

### Module C: Doctors Directory (`/api/v1/doctors`)

#### 8. `GET /api/v1/doctors`
* **Access:** Public
* **Query Parameters:**
  * `specialization` (optional, e.g. `Cardiology`)
  * `search` (optional, e.g. `Karim`)
  * `page` (default 1), `pageSize` (default 20)
* **Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "Dr. Karim Chowdhury",
      "specialization": "Cardiology",
      "degrees": "MBBS, FCPS (Cardiology), MD (USA)",
      "facility": "Popular Diagnostic Centre, Dhanmondi",
      "chamber": "Chamber #402, Level 4",
      "consultationFee": 1200.00,
      "rating": 4.9,
      "experienceYears": 16,
      "bio": "Senior Consultant Cardiologist specializing in adult cardiac care."
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "totalCount": 1 }
}
```

#### 9. `POST /api/v1/doctors`
* **Access:** Admin only
* **Purpose:** Onboard doctor profile into clinic directory.
* **Response `201 Created`:** Returns created doctor record.

---

### Module D: Availability, Shifts & Bulk Slot Generator (`/api/v1/availability`)

#### 10. `GET /api/v1/availability/{doctorId}`
* **Access:** Public (Used by Mobile slot picker & Web)
* **Query Parameters:** `date` (Required: `YYYY-MM-DD`, e.g. `2026-09-10`)
* **Purpose:** Dynamically compute open slots. Backend subtracts booked appointments and blocks exceptions.
* **Response `200 OK`:**
```json
{
  "doctorId": "11111111-2222-3333-4444-555555555555",
  "date": "2026-09-10",
  "slotDurationMinutes": 30,
  "bufferMinutes": 10,
  "slots": [
    { "startTime": "2026-09-10T10:00:00Z", "endTime": "2026-09-10T10:30:00Z", "isAvailable": false },
    { "startTime": "2026-09-10T10:40:00Z", "endTime": "2026-09-10T11:10:00Z", "isAvailable": false },
    { "startTime": "2026-09-10T11:20:00Z", "endTime": "2026-09-10T11:50:00Z", "isAvailable": true },
    { "startTime": "2026-09-10T12:00:00Z", "endTime": "2026-09-10T12:30:00Z", "isAvailable": true }
  ]
}
```

#### 11. `PUT /api/v1/availability/{doctorId}/recurring`
* **Access:** Doctor (Self) or Admin
* **Purpose:** Set base weekly shift templates in `availability` table.
* **Request Body:**
```json
{
  "shifts": [
    { "dayOfWeek": 0, "startTime": "09:00", "endTime": "13:00", "slotDurationMinutes": 30, "bufferMinutes": 10 },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "13:00", "slotDurationMinutes": 30, "bufferMinutes": 10 },
    { "dayOfWeek": 4, "startTime": "10:00", "endTime": "13:00", "slotDurationMinutes": 30, "bufferMinutes": 10 }
  ]
}
```
* **Response `200 OK`:** `{ "message": "Weekly recurring shifts updated successfully." }`

#### 12. `POST /api/v1/availability/{doctorId}/exceptions`
* **Access:** Doctor (Self) or Admin
* **Purpose:** Block a specific calendar date (holiday, emergency leave, conference).
* **Request Body:**
```json
{
  "exceptionDate": "2026-09-11",
  "isAvailable": false,
  "reason": "Weekly Clinic Holiday (Friday)"
}
```
* **Response `201 Created`:** Returns blocked exception record.

#### 13. `POST /api/v1/availability/{doctorId}/bulk-generate`
* **Access:** Doctor (Self) or Admin
* **Purpose:** Bulk publish recurring appointment slots for the **Next Whole Week (7 Days)** or **Next Whole Month (30 Days)**.
* **Request Body:**
```json
{
  "targetRange": "month",
  "startDate": "2026-10-01",
  "endDate": "2026-10-31",
  "daysOfWeek": [0, 1, 2, 3, 4, 6],
  "startTime": "09:00",
  "endTime": "13:00",
  "slotDurationMinutes": 30,
  "bufferMinutes": 10,
  "applyHolidays": true
}
```
* **Response `201 Created`:**
```json
{
  "totalSlotsCreated": 132,
  "dateRange": "2026-10-01 to 2026-10-31",
  "workingDaysCount": 22,
  "holidaysSkipped": 4,
  "slotsPerDay": 6,
  "message": "132 slots successfully published across 22 working days. Fridays excluded."
}
```

---

### Module E: Appointments Lifecycle & Chamber Queue (`/api/v1/appointments`)

#### 14. `POST /api/v1/appointments/book`
* **Access:** Patient
* **Mandatory Header:** `Idempotency-Key: <UUIDv4>`
* **Purpose:** Reserve appointment slot. No upfront fee; assigns sequential daily serial/token number.
* **Request Body:**
```json
{
  "doctorId": "11111111-2222-3333-4444-555555555555",
  "startTime": "2026-09-10T10:40:00Z",
  "endTime": "2026-09-10T11:10:00Z",
  "visitType": "new_consultation",
  "chiefComplaint": "Severe chest tightness and shortness of breath for 4 days."
}
```
* **Response `201 Created`:**
```json
{
  "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "patientId": "7a35f0b4-82a1-408a-bfe0-3323c21a4f02",
  "doctorId": "11111111-2222-3333-4444-555555555555",
  "doctorName": "Dr. Karim Chowdhury",
  "specialization": "Cardiology",
  "tokenNumber": 4,
  "startTime": "2026-09-10T10:40:00Z",
  "endTime": "2026-09-10T11:10:00Z",
  "status": "confirmed",
  "paymentStatus": "pay_at_chamber",
  "fee": 1200.00,
  "createdAt": "2026-09-07T12:05:00Z"
}
```
* **Conflict Response `409 Conflict` (PostgreSQL GiST Violation):**
```json
{
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "The requested slot has just been reserved. Please select another slot.",
    "status": 409
  }
}
```

#### 15. `PUT /api/v1/appointments/{id}/reschedule`
* **Access:** Patient (Owner)
* **Mandatory Header:** `Idempotency-Key: <UUIDv4>`
* **Purpose:** Atomic cancel & rebook in a single database transaction.
* **Request Body:**
```json
{
  "newStartTime": "2026-09-12T10:00:00Z",
  "newEndTime": "2026-09-12T10:30:00Z"
}
```
* **Response `200 OK`:** Returns rescheduled appointment with new `tokenNumber`.

#### 16. `PUT /api/v1/appointments/{id}/cancel`
* **Access:** Patient (Owner) or Admin
* **Purpose:** Instantly frees the time slot back to public availability.
* **Request Body:** `{ "reason": "Patient requested cancellation" }`
* **Response `200 OK`:** `{ "id": "...", "status": "cancelled", "cancelledAt": "2026-09-07T12:15:00Z" }`

#### 17. `PUT /api/v1/appointments/{id}/status`
* **Access:** Doctor (Assigned) or Admin
* **Purpose:** Mark visit as `completed` or `no_show`.
* **Request Body:** `{ "status": "completed" }`
* **Response `200 OK`:** `{ "id": "...", "status": "completed", "updatedAt": "..." }`

#### 18. `GET /api/v1/appointments/doctor/{doctorId}`
* **Access:** Doctor (Assigned) or Admin
* **Query Parameters:** `date` (Required: `YYYY-MM-DD`)
* **Privacy Enforcement:**
  * **Doctor:** Full clinical access (`chiefComplaint`, recorded `vitals`, `history`).
  * **Admin:** Operational view only. `chiefComplaint` is masked as `"🔒 Clinical Problem Masked"`.
* **Response `200 OK`:**
```json
{
  "date": "2026-09-10",
  "totalAppointments": 4,
  "queue": [
    {
      "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "serial": 4,
      "patientId": "7a35f0b4-82a1-408a-bfe0-3323c21a4f02",
      "patientName": "Rahim Ahmed",
      "age": 34,
      "gender": "Male",
      "phone": "+880 1711-987654",
      "visitType": "New Consultation",
      "chiefComplaint": "Severe chest tightness and shortness of breath for 4 days.",
      "vitals": "BP: 135/85 mmHg · Pulse: 78 bpm",
      "startTime": "2026-09-10T10:40:00Z",
      "endTime": "2026-09-10T11:10:00Z",
      "status": "waiting"
    }
  ]
}
```

#### 19. `GET /api/v1/appointments/patient/me`
* **Access:** Patient
* **Query Parameters:** `filter` (`upcoming` | `past`, default `upcoming`)
* **Response `200 OK`:** Returns patient's bookings with `tokenNumber`, doctor chamber details, and payment status.

#### 20. `PUT /api/v1/appointments/doctor/{doctorId}/queue-pause`
* **Access:** Doctor (Self) or Admin
* **Purpose:** Hold queue for short doctor rest break (5–10 mins).
* **Empty Chamber Invariant:** Actively consulting patient is marked `completed`. Chamber status changes to `EMPTY (BREAK)`. No patient holds `in_queue` status during the break.
* **Request Body:**
```json
{
  "pauseMinutes": 5,
  "reason": "Short clinical break / documentation"
}
```
* **Response `200 OK`:**
```json
{
  "isPaused": true,
  "chamberStatus": "EMPTY (BREAK)",
  "pauseMinutes": 5,
  "resumeAt": "2026-09-10T10:45:00Z",
  "message": "Chamber queue paused. Patient waiting trackers notified."
}
```

#### 21. `PUT /api/v1/appointments/doctor/{doctorId}/queue-resume`
* **Access:** Doctor (Self) or Admin
* **Purpose:** Resume chamber queue and call in next sequential token.
* **Response `200 OK`:**
```json
{
  "isPaused": false,
  "currentlyServingSerial": 3,
  "chamberStatus": "ACTIVE",
  "message": "Queue resumed. Calling Serial #03 into chamber."
}
```

---

### Module F: Admin & Audit Oversight (`/api/v1/admin`)

#### 22. `GET /api/v1/admin/analytics`
* **Access:** Admin only
* **Query Parameters:** `from` (`YYYY-MM-DD`), `to` (`YYYY-MM-DD`)
* **Response `200 OK`:**
```json
{
  "totalBookings": 450,
  "completedCount": 380,
  "noShowCount": 35,
  "cancelledCount": 35,
  "noShowRatePercentage": 7.78,
  "activeDoctors": 12,
  "registeredPatients": 1250
}
```

#### 23. `GET /api/v1/admin/audit-log`
* **Access:** Admin only
* **Query Parameters:** `page` (default 1), `pageSize` (default 20), `action` (optional string)
* **Response `200 OK`:** Returns immutable, tamper-proof audit trail records.

---

### Module G: Notifications & Device Registry (`/api/v1/notifications` & `/api/v1/devices`)

#### 24. `POST /api/v1/devices/fcm-token`
* **Access:** Authenticated Users (Patient or Doctor)
* **Purpose:** Register or refresh Firebase Cloud Messaging (FCM) or APNs push device token.
* **Request Body:**
```json
{
  "fcmToken": "cK12jfk8s9_dK9s_sample_fcm_token_string_abc123",
  "deviceType": "android",
  "deviceModel": "Google Pixel 7 Pro"
}
```
* **Response `200 OK`:**
```json
{
  "deviceId": "44444444-4444-4444-4444-444444444441",
  "fcmToken": "cK12jfk8s9_dK9s_sample_fcm_token_string_abc123",
  "deviceType": "android",
  "isActive": true,
  "updatedAt": "2026-09-07T14:00:00Z"
}
```

#### 25. `GET /api/v1/notifications`
* **Access:** Authenticated Users (Self)
* **Purpose:** Retrieve paginated in-app notification feed for the Notification Hub with unread badge counter.
* **Query Parameters:**
  * `page` (integer, default `1`)
  * `pageSize` (integer, default `20`)
  * `unreadOnly` (boolean, default `false`)
* **Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "55555555-5555-5555-5555-555555555551",
      "title": "Appointment Confirmed! 🎫",
      "body": "Serial #04 assigned with Dr. Karim Chowdhury for today.",
      "notificationType": "booking_confirmed",
      "appointmentId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "isRead": false,
      "metadata": { "tokenNumber": 4, "doctorName": "Dr. Karim Chowdhury" },
      "createdAt": "2026-09-07T13:45:00Z"
    }
  ],
  "unreadCount": 1,
  "total": 3,
  "page": 1,
  "pageSize": 20
}
```

#### 26. `PATCH /api/v1/notifications/{id}/read`
* **Access:** Authenticated Users (Owner of notification)
* **Purpose:** Mark an individual notification card as read.
* **Response `200 OK`:** `{ "id": "...", "isRead": true, "readAt": "2026-09-07T14:05:00Z" }`

#### 27. `POST /api/v1/notifications/mark-all-read`
* **Access:** Authenticated Users (Self)
* **Purpose:** Clear all unread badges across user's notification feed.
* **Response `200 OK`:** `{ "success": true, "markedCount": 3 }`

---

## 5. Frontend & Backend Developer Integration Guide

### 📱 For Flutter Mobile Developers (Patient App)
1. **Model Generation:** Use `json_serializable` with field names matching `camelCase`.
2. **Idempotency Setup:** For `book` and `reschedule`, generate a UUID before network dispatch:
   ```dart
   final idempotencyKey = const Uuid().v4();
   dio.options.headers['Idempotency-Key'] = idempotencyKey;
   ```
3. **FCM Push Notification Handling:**
   - Register FCM token on app initialization via `POST /api/v1/devices/fcm-token`.
   - On background message received, show native system tray banner with sound.
   - On foreground message received, play haptic feedback and display the custom slide-down banner as demonstrated in the prototype.
   - Tap on banner deep-links directly to either `screen-my` (live queue tracker) or `screen-notifications`.
4. **Handling 409 Conflict:** When `DioException` has response code `409` and `error.code == 'SLOT_CONFLICT'`, display a Toast/Snackbar: *"এই স্লটটি অলরেডি বুক হয়ে গেছে, অনুগ্রহ করে অন্য সময় বেছে নিন।"* and refresh the slot picker.

### 💻 For Next.js Web Developers (Admin & Doctor Portals)
1. **API Client:** Use React Query / TanStack Query with fetcher or Axios.
2. **Date Timezone Presentation:** The API returns timestamps in UTC (`...Z`). Always convert using `Intl.DateTimeFormat` or `date-fns` to local viewer timezone (`Asia/Dhaka`).
3. **Doctor Queue Refreshing:** On `/appointments/doctor/[id]`, refetch every 30 seconds or trigger on window focus.

### 🐍 For FastAPI Backend Developers
1. **Pydantic Model Base:**
   ```python
   from pydantic import BaseModel, ConfigDict
   from pydantic.alias_generators import to_camel

   class APIModel(BaseModel):
       model_config = ConfigDict(
           alias_generator=to_camel,
           populate_by_name=True,
           from_attributes=True
       )
   ```
2. **Exclusion Constraint Trap:** Catch PostgreSQL code `23P01`:
   ```python
   try:
       await db.commit()
   except IntegrityError as exc:
       if "no_overlapping_appointments" in str(exc.orig):
           raise HTTPException(status_code=409, detail={
               "code": "SLOT_CONFLICT",
               "message": "The requested slot is no longer available."
           })
   ```
3. **Idempotency Middleware:** Intercept incoming `Idempotency-Key` header, check Redis key `idemp:{key}`. If hit, return cached response directly.

---
**Lock Sign-off:** All 27 endpoints locked and permanently synchronized with database schema, OpenAPI spec, and UI prototype.
