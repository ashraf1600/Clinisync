# Product Requirement Document (PRD)
## Appointment Booking System (Web + Mobile)
**System Name:** CliniSync / ShebaSync  
**Platform:** Next.js (Web), Flutter (Mobile), FastAPI (Backend), PostgreSQL + Redis  
**Target Delivery:** 20 Working Days (MVP) · **Status:** Ready for Development

---

## [PAGE 1] Product Overview, Objectives & RBAC Matrix

### 1. Executive Summary & Vision
The **Appointment Booking System** is a production-grade, multi-platform scheduling solution engineered to eliminate scheduling conflicts, guarantee zero double-bookings under concurrent traffic, and unify patient care workflows. The platform serves two primary frontends consuming a single unified REST API:
* **Web Portal (Next.js):** Tailored for Healthcare Administrators and Doctors (onboarding, queue management, schedule rules, analytics).
* **Mobile App (Flutter):** Tailored for Patients (real-time slot discovery, 1-tap booking, instant rescheduling, push notifications).

### 2. Problem Statement
Traditional clinic scheduling systems suffer from major operational bottlenecks:
* **Double-Bookings & Race Conditions:** Concurrent bookings across multiple clients or network delays cause overlapping slots.
* **Lack of Centralized Records:** Fragmented communication leads to lost visit histories and uncontrolled doctor queues.
* **No Reschedule Path:** Patients must cancel and rebook manually, increasing drop-offs and administrative overhead.
* **Doctor Burnout & Zero Buffer:** Back-to-back appointments leave clinicians no margin for notes, hygiene, or overruns.
* **Timezone Inconsistencies:** Un-normalized timestamps corrupt availability calculations across multi-region clinics.

### 3. Core Objectives
1. **Database-Level Conflict Prevention:** Guarantee zero overlapping slots at the database storage engine layer (ACID-enforced), eliminating reliance on error-prone application checks.
2. **True Idempotency:** Protect against double-click submissions and network retry duplicates via client-generated unique idempotency keys.
3. **Atomic Rescheduling:** Execute appointment rescheduling as an atomic cancellation-and-rebooking transaction.
4. **Lean, Production-Ready Architecture:** Deliver high-performance REST APIs without premature distributed lock complexity.

### 4. Role-Based Access Control (RBAC) Matrix
All API endpoints strictly validate JWT claims server-side with automated 403 audit logging.

| Role | Target Actor | Primary Capabilities | Operational Boundaries |
| :--- | :--- | :--- | :--- |
| **Patient** | End-user seeking care | Register/login, browse doctor catalog, 1-tap book/cancel/reschedule, view history, receive push & email alerts. | Strictly isolated to own medical records; cannot access other patients' data or alter clinic schedule rules. |
| **Doctor** | Healthcare Provider | Authenticate, configure recurring weekly hours & buffer times, view daily patient queue, toggle visit status (`completed`, `no_show`), block emergency time-off. | Cannot view or modify records belonging to other doctors' patients; cannot alter administrative settings. |
| **Admin** | Clinic Ops / System Admin | Onboard and verify doctors, manage system users, override/cancel any appointment, configure clinic holidays, view audit trails & operational metrics. | Full system-wide oversight. All manual overrides and deletions are permanently recorded in the immutable audit log. |

---

## [PAGE 2] Platform Architecture, Tech Stack & MVP Feature Scope

### 5. Architectural Topology
The system follows a clean client-server architecture. Both the Web dashboard and Mobile application communicate exclusively with a single stateless FastAPI backend over HTTPS, with data persistence managed by PostgreSQL and Redis.

```
       [ Patients ]                   [ Doctors & Clinic Admins ]
      Flutter Mobile                        Next.js Web
             │                                   │
             └───────────────┬───────────────────┘
                             │ HTTPS / JSON (JWT)
                             ▼
                 [ FastAPI Application Layer ]
            ├── RBAC & Auth Middleware (JWT / Bcrypt)
            ├── Idempotency Interceptor (Redis Cache)
            ├── Slot Calculation Engine (Buffers & Exceptions)
            └── Async Notification Worker (FCM & Email)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ PostgreSQL 15+ ]                  [ Redis 7+ ]
   • Range Exclusion (btree_gist)      • Idempotency Keys (24h TTL)
   • Relational ACID Data              • Notification Task Queue Backing
```

### 6. Technology Stack

| Layer | Component | Technology | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Admin & Doctor Portals | **Next.js (React)** | Server-side rendering for snappy dashboard loads, rich data tables, and secure session management. |
| **Mobile Client** | Patient Application | **Flutter (Dart)** | Single cross-platform codebase for iOS and Android, offering 60fps native UI and instant slot selection. |
| **Backend API** | Business Logic & REST | **FastAPI (Python)** | High-throughput asynchronous performance, automated OpenAPI generation, and strict Pydantic data validation. |
| **Primary Database** | Relational Persistence | **PostgreSQL (btree_gist)** | Rock-solid relational integrity with specialized range-exclusion constraint capabilities for scheduling. |
| **In-Memory Cache** | Key-Value Store | **Redis** | Sub-millisecond lookup for idempotency key verification and lightweight background task dispatching. |
| **Authentication** | Identity & Sessions | **JWT (Bearer Tokens)** | Stateless authentication with short-lived access tokens and secure refresh token exchange. |

### 7. Core Functional Modules (MVP)
* **Auth & Security:** Email/password registration, bcrypt password hashing (cost >= 12), rate limiting (5 attempts/15 min), password recovery via time-limited signed tokens.
* **Doctor Management:** Specialty categorization, professional bios, profile imagery, and weekly recurring shift templates.
* **Dynamic Slot Engine:** Real-time computation of bookable slots derived from:  
  `Available Slots = Recurring Shifts - Clinic Exceptions - Active Bookings - Buffer Windows`
* **Lifecycle State Machine:** Appointments progress deterministically through:  
  `pending` -> `confirmed` -> `completed` OR `cancelled` OR `no_show`.
* **Async Notifications:** Non-blocking notification dispatch for confirmations, 24h & 1h appointment reminders, and cancellation alerts via FCM and SMTP.

---

## [PAGE 3] Conflict Prevention Engine, Idempotency & Buffering

### 8. The Race Condition Challenge
In concurrent booking systems, standard application-level checks (such as `SELECT COUNT(*) WHERE start_time = X`) are inherently prone to race conditions. Two concurrent requests can simultaneously pass the availability check before either writes to the database, resulting in duplicate bookings. Furthermore, appointments of varying durations (e.g., 30 min vs 45 min) easily overlap without sharing the exact same start timestamp.

### 9. Database-Enforced Exclusion Constraint
CliniSync resolves concurrency at the storage layer using PostgreSQL's generalized search tree (`GiST`) index with `btree_gist`. Overlaps are physically rejected by the database kernel:

```sql
-- Enable PostgreSQL GiST operator support for standard types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enforce strict non-overlapping intervals per doctor
ALTER TABLE appointments ADD CONSTRAINT exclude_overlapping_appointments
EXCLUDE USING GIST (
    doctor_id WITH =,
    appointment_range WITH &&
) WHERE (status <> 'cancelled');
```

#### Key Technical Guarantees:
1. **Half-Open Intervals `[start, end)`:** Uses PostgreSQL `TSTZRANGE`. If Appointment A is `[09:00, 09:30)` and Appointment B is `[09:30, 10:00)`, the boundary value `09:30` does **not** conflict. Back-to-back scheduling works seamlessly.
2. **Instant Slot Reclamation:** The conditional predicate `WHERE (status <> 'cancelled')` ensures that whenever an appointment is cancelled, its interval is released immediately for rebooking without deleting the row or breaking audit trails.
3. **Database-Level Atomic Rejection:** If two concurrent transactions attempt to book overlapping ranges, PostgreSQL immediately raises a serialization/exclusion violation (`SQLSTATE 23P01`). The API traps this error and returns HTTP `409 Conflict` (`SLOT_CONFLICT`).

### 10. End-to-End Idempotency (Duplicate Prevention)
To guard against mobile network retries, double-tap taps, or timeout repetitions from the same patient:
1. Every `POST /api/appointments/book` and `PUT /api/appointments/:id/reschedule` request must supply an `Idempotency-Key: <UUID>` HTTP header.
2. The server checks Redis for the key:
   * If present: The cached response payload is immediately returned to the client without re-executing logic.
   * If absent: The booking executes within a database transaction; upon successful commit, the serialized response is stored in Redis with a 24-hour Time-To-Live (TTL).

### 11. Doctor Rest Buffers & Atomic Rescheduling
* **Invisible Doctor Buffers:** Clinicians can configure a `buffer_minutes` setting (e.g., 10 minutes). The system adds this buffer to the exclusion check interval:  
  `Conflict Check Interval = [start_time, end_time + buffer_minutes)`  
  The patient sees their clean booking time (e.g., 10:00–10:30), while the system reserves 10:00–10:40 to ensure doctors have rest and charting time.
* **Atomic Reschedule:** Rescheduling is executed within a single database transaction (`BEGIN ... COMMIT`):
  1. Set existing appointment status to `cancelled`.
  2. Insert new appointment range with exclusion check.
  3. If the new slot fails, rollback the entire transaction, leaving the original booking intact.

---

## [PAGE 4] Relational Database Schema & Data Dictionary

All datetime values are normalized to UTC using `TIMESTAMPTZ`.

```sql
-- 1. Users Table (Core Identity & RBAC)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Doctors Table (Clinical Profile Extension)
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialization VARCHAR(100) NOT NULL,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Availability Table (Weekly Recurring Templates)
CREATE TABLE availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT NOT NULL DEFAULT 30,
    buffer_minutes INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_time_order CHECK (start_time < end_time)
);

-- 4. Availability Exceptions Table (Holidays & Ad-Hoc Time-Off)
CREATE TABLE availability_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT false,
    reason VARCHAR(255)
);

-- 5. Appointments Table (Active & Historical Bookings)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id),
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    appointment_range TSTZRANGE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT no_overlapping_appointments
        EXCLUDE USING GIST (
            doctor_id WITH =,
            appointment_range WITH &&
        ) WHERE (status <> 'cancelled')
);

-- 6. Idempotency Keys (Persistent Fallback / Redis Mirror)
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Audit Log Table (Compliance & Regulatory Traceability)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## [PAGE 5] REST API Specifications & Testing Strategy

### 12. Primary API Endpoint Catalog
All secured endpoints expect the header `Authorization: Bearer <JWT_TOKEN>`.

| Domain | Method | Endpoint Path | Role Access | Function & Headers |
| :--- | :---: | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Public | Register patient account. |
| **Auth** | `POST` | `/api/v1/auth/login` | Public | Return access (15m) + refresh (7d) JWTs. |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Public | Rotate and renew expired access token. |
| **Auth** | `POST` | `/api/v1/auth/forgot-password` | Public | Generate & email password reset token. |
| **Auth** | `POST` | `/api/v1/auth/reset-password` | Public | Set new password with valid token. |
| **Users** | `GET` | `/api/v1/users/me` | Authenticated | Retrieve authenticated user profile. |
| **Users** | `PUT` | `/api/v1/users/me` | Authenticated | Update name, phone, or preferences. |
| **Doctors** | `GET` | `/api/v1/doctors` | Public | Search/filter doctors by specialty. |
| **Doctors** | `POST` | `/api/v1/doctors` | Admin | Onboard new clinician profile. |
| **Schedule**| `GET` | `/api/v1/availability/{doctorId}` | Public | Compute free slots applying buffers & bookings. |
| **Schedule**| `PUT` | `/api/v1/availability/{doctorId}/recurring` | Admin / Doctor | Set weekly recurring shifts. |
| **Schedule**| `POST`| `/api/v1/availability/{doctorId}/exceptions`| Admin / Doctor | Block holiday or time-off date. |
| **Schedule**| `POST`| `/api/v1/availability/{doctorId}/bulk-generate`| Admin / Doctor | Bulk publish slots for whole week/month. |
| **Bookings**| `POST` | `/api/v1/appointments/book` | Patient | Free booking with `Idempotency-Key` & serial #. |
| **Bookings**| `PUT` | `/api/v1/appointments/{id}/reschedule` | Patient | Atomic reschedule. `Idempotency-Key`. |
| **Bookings**| `PUT` | `/api/v1/appointments/{id}/cancel` | Patient / Admin | Cancel appointment (releases slot). |
| **Bookings**| `PUT` | `/api/v1/appointments/{id}/status` | Doctor / Admin | Mark visit as `completed` or `no_show`. |
| **Bookings**| `GET` | `/api/v1/appointments/doctor/{doctorId}` | Doctor / Admin | Daily queue (with patient problem & vitals). |
| **Bookings**| `GET` | `/api/v1/appointments/patient/me` | Patient | List patient's bookings with token slips. |
| **Queue**   | `PUT` | `/api/v1/appointments/doctor/{doctorId}/queue-pause` | Doctor / Admin | Hold queue for 5m break (empty chamber). |
| **Queue**   | `PUT` | `/api/v1/appointments/doctor/{doctorId}/queue-resume`| Doctor / Admin | Resume chamber and call next token. |
| **Admin**   | `GET` | `/api/v1/admin/analytics` | Admin | Metrics: booking volume, no-show rate. |
| **Admin**   | `GET` | `/api/v1/admin/audit-log` | Admin | Paginated immutable operational log. |
| **Notif**   | `POST`| `/api/v1/devices/fcm-token` | Authenticated | Register/refresh mobile push device token. |
| **Notif**   | `GET` | `/api/v1/notifications` | Authenticated | Fetch in-app notification feed with unread counter. |
| **Notif**   | `PATCH`| `/api/v1/notifications/{id}/read` | Authenticated | Mark individual notification as read. |
| **Notif**   | `POST`| `/api/v1/notifications/mark-all-read` | Authenticated | Clear all unread badges across feed. |

### 13. Error Handling Contract
Standardized JSON error envelope:
```json
{
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "The requested appointment time has just been booked. Please choose another slot.",
    "details": { "doctorId": "d3b07384...", "conflictingRange": "2026-09-10T10:00:00Z/2026-09-10T10:30:00Z" }
  }
}
```

### 14. Verification & Testing Matrix
* **Mandatory Concurrency Load Test:** Execute automated suite dispatching $N=50$ simultaneous `POST /api/appointments/book` requests for the exact same doctor and slot. **Pass Criteria:** Exactly $1$ request returns `201 Created`; exactly $49$ requests return `409 Conflict` (`SLOT_CONFLICT`). Zero duplicate rows in database.
* **Idempotency Verification:** Send 2 identical requests with the same `Idempotency-Key`. **Pass Criteria:** Only one appointment inserted; both calls return identical responses.
* **Atomic Reschedule Test:** Reschedule against an already occupied target slot. **Pass Criteria:** Target booking fails, and the original appointment remains intact (`confirmed`).

---

## [PAGE 6] NFRs, Compliance & 20-Day Execution Roadmap

### 15. Non-Functional Requirements (NFRs)
* **Performance:** API 95th percentile latency ($p95$) $< 300\text{ms}$ under 100 concurrent requests.
* **Reliability:** 99.5% service uptime; zero double-bookings permitted under any load condition.
* **Security & Privacy:** Enforce TLS 1.3 in transit; bcrypt password hashing (cost >= 12); parameterized queries; no sensitive tokens in application logs.
* **Scalability:** Stateless API layer containerized on Docker, ready for horizontal pod auto-scaling.

### 16. Regulatory & Privacy Context (Bangladesh)
* **Legal Landscape:** While the comprehensive Personal Data Protection Act (PDPA 2023) is pending gazette publication, the **Cyber Security Act (CSA)** actively criminalizes unauthorized collection, leakage, or mishandling of personal identity data (name, contact, national identifiers) with severe penalties (fines up to 5,00,000 BDT and imprisonment).
* **Compliance Safeguards Built In:**
  1. Strict RBAC ensures patients can never view records of other individuals.
  2. The `audit_log` records every administrative override or record inspection.
  3. No clinical diagnosis data is captured in the MVP scheduling phase, minimizing compliance risk.

### 17. Scope Boundaries (Explicitly Deferred)
To preserve development velocity and avoid premature optimization, the following are out-of-scope for the MVP:
* *Redis Distributed Locks:* Unnecessary overhead because the PostgreSQL range constraint already provides ACID-level guarantees.
* *Payment Gateways:* Deferred to post-MVP phase.
* *Video Consultation:* In-person clinic appointments only.
* *SMS Integration:* Communication limited to Push (FCM) and Transactional Email (SMTP).

### 18. 20-Working-Day Implementation Roadmap

| Phase | Duration | Core Deliverables & Milestone |
| :--- | :---: | :--- |
| **Phase 1** | Days 1–3 | **Database & Security Foundation:** PostgreSQL schema setup with `btree_gist`, JWT authentication, RBAC middleware, rate limiting. |
| **Phase 2** | Days 4–7 | **Core Booking Engine:** Exclusion-constraint handling, slot calculation algorithm, buffer logic, idempotency filter, atomic rescheduling. |
| **Phase 3** | Days 8–10 | **Notification & Background Jobs:** Redis task queue, Firebase Cloud Messaging (FCM), transactional email dispatch, 24h/1h reminders. |
| **Phase 4** | Days 11–13 | **Web Portals (Next.js):** Admin dashboard, doctor profile onboarding, weekly schedule builder, appointment queue, audit viewer. |
| **Phase 5** | Days 14–16 | **Mobile Client (Flutter):** Patient registration/login, doctor directory & filtering, slot picker, booking management, push alerts. |
| **Phase 6** | Days 17–19 | **Hardening & Verification:** Concurrency simulation test suite, idempotency tests, end-to-end user flows, bug fixing. |
| **Phase 7** | Day 20 | **Deployment & Release:** Docker containerization, staging environment deployment, operational documentation handoff. |
