-- ============================================================================
-- CliniSync / ShebaSync - PostgreSQL Production Database Schema
-- Version: 1.0.0
-- Target RDBMS: PostgreSQL 15+
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Create Reusable Trigger Function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Users Table (Core Identity & RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(30),
    blood_group VARCHAR(5),
    address VARCHAR(500),
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. Doctors Table (Clinical Profile)
-- ============================================================================
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialization VARCHAR(100) NOT NULL,
    degrees VARCHAR(255) NOT NULL DEFAULT 'MBBS',
    bmdc_number VARCHAR(50) NOT NULL DEFAULT 'BMDC-PENDING',
    designation VARCHAR(150),
    facility_name VARCHAR(255) NOT NULL DEFAULT 'Popular Diagnostic Centre',
    chamber_room VARCHAR(255) NOT NULL DEFAULT 'Room #402, Level 4',
    profile_photo_url TEXT,
    bio TEXT,
    consultation_fee NUMERIC(10, 2) NOT NULL DEFAULT 1200.00,
    followup_fee NUMERIC(10, 2) NOT NULL DEFAULT 800.00,
    rating FLOAT NOT NULL DEFAULT 4.9,
    experience_years INT NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors (specialization);

CREATE TRIGGER trg_doctors_updated_at
BEFORE UPDATE ON doctors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4b. Doctor Locations (one doctor can practice at many facilities)
CREATE TABLE IF NOT EXISTS doctor_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    facility_name VARCHAR(255) NOT NULL,
    branch_area VARCHAR(255),
    chamber_room VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    contact_phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_doctor_locations_doctor ON doctor_locations (doctor_id);

-- ============================================================================
-- 5. Availability Table (Recurring Weekly Shift Templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0),
    buffer_minutes INT NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT chk_shift_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_doctor_day ON availability (doctor_id, day_of_week);

-- ============================================================================
-- 6. Availability Exceptions Table (Holidays & Off Days)
-- ============================================================================
CREATE TABLE IF NOT EXISTS availability_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT false,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doctor_exception_date UNIQUE (doctor_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_exceptions_lookup ON availability_exceptions (doctor_id, exception_date);

-- ============================================================================
-- 7. Appointments Table (With GiST Range Exclusion Constraint)
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES doctor_locations(id) ON DELETE SET NULL,
    token_number INT NOT NULL DEFAULT 1,
    chief_complaint TEXT,
    visit_type VARCHAR(50) NOT NULL DEFAULT 'new_consultation',
    appointment_range TSTZRANGE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pay_at_chamber' CHECK (payment_status IN ('pay_at_chamber', 'paid', 'waived')),
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    cancellation_reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ZERO DOUBLE-BOOKING GUARANTEE (Kernel Level Exclusion)
    CONSTRAINT no_overlapping_appointments
        EXCLUDE USING GIST (
            doctor_id WITH =,
            appointment_range WITH &&
        ) WHERE (status <> 'cancelled')
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments (doctor_id, (lower(appointment_range)));
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_location ON appointments (location_id);

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION sync_appointment_range()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_range IS NULL AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
        NEW.appointment_range = tstzrange(NEW.start_time, NEW.end_time, '[)');
    ELSIF NEW.appointment_range IS NOT NULL THEN
        NEW.start_time = lower(NEW.appointment_range);
        NEW.end_time = upper(NEW.appointment_range);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_appointment_range
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION sync_appointment_range();

-- ============================================================================
-- 8. Idempotency Keys (Duplicate Request Protection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    response_code INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expires_at);

-- ============================================================================
-- 9. Audit Log (Regulatory Compliance & Non-Repudiation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    metadata JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_id, timestamp DESC);

-- ============================================================================

-- ============================================================================
-- 10. Tamper-Proof Audit Log Trigger (Immutable Compliance)
-- ============================================================================
CREATE OR REPLACE FUNCTION freeze_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log records are immutable and cannot be modified or deleted!';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_freeze_audit
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION freeze_audit_log();

-- ============================================================================
-- 11. Notifications & Device Registry Subsystem
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('android', 'ios', 'web')),
    device_model VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_device_fcm UNIQUE (user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_active ON user_devices (user_id, is_active);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'booking_confirmed',
        'queue_update',
        'doctor_break',
        'reminder_24h',
        'reminder_1h',
        'cancelled',
        'system'
    )),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

-- 12. Initial Seed Data (Development / Testing Fixtures)
-- ============================================================================
-- Admin (Password: AdminPass123!)
INSERT INTO users (id, name, email, password_hash, role, timezone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Administrator',
    'admin@clinic.com',
    '$2b$12$e8Y5tGq6RkYmPjH8ZqGkye7y4h5A6b7C8d9E0F1G2H3I4J5K6L7M8',
    'admin',
    'Asia/Dhaka'
) ON CONFLICT DO NOTHING;

-- Doctor User (Password: DoctorPass123!)
INSERT INTO users (id, name, email, password_hash, role, timezone)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Dr. Karim Chowdhury',
    'doctor.karim@clinic.com',
    '$2b$12$e8Y5tGq6RkYmPjH8ZqGkye7y4h5A6b7C8d9E0F1G2H3I4J5K6L7M8',
    'doctor',
    'Asia/Dhaka'
) ON CONFLICT DO NOTHING;

-- Doctor Profile
INSERT INTO doctors (id, user_id, specialization, bio, consultation_fee)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Cardiology',
    'Senior Consultant in Interventional Cardiology with 15+ years experience.',
    1200.00
) ON CONFLICT DO NOTHING;

INSERT INTO doctor_locations (doctor_id, facility_name, branch_area, chamber_room, address)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Popular Diagnostic Centre',
    'Dhanmondi, Dhaka',
    'Room #402, Level 4',
    'House spr 16, Road 2, Dhanmondi, Dhaka'
) ON CONFLICT DO NOTHING;

-- Doctor Weekly Availability: Sunday & Tuesday (9:00 AM - 1:00 PM, 30 min slots, 10 min buffer)
INSERT INTO availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, buffer_minutes)
VALUES 
    ('22222222-2222-2222-2222-222222222222', 0, '09:00:00', '13:00:00', 30, 10),
    ('22222222-2222-2222-2222-222222222222', 2, '09:00:00', '13:00:00', 30, 10)
ON CONFLICT DO NOTHING;

-- Patient User (Password: PatientPass123!)
INSERT INTO users (id, name, email, password_hash, role, timezone)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Rahim Ahmed',
    'rahim@example.com',
    '$2b$12$e8Y5tGq6RkYmPjH8ZqGkye7y4h5A6b7C8d9E0F1G2H3I4J5K6L7M8',
    'patient',
    'Asia/Dhaka'
) ON CONFLICT DO NOTHING;

-- Seed Device Token for Patient Rahim
INSERT INTO user_devices (id, user_id, fcm_token, device_type, device_model)
VALUES (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333333',
    'fcm_token_sample_rahim_pixel_device_abc123xyz',
    'android',
    'Pixel 7 Pro'
) ON CONFLICT DO NOTHING;

-- Seed Sample Notifications for Patient Rahim (matching Mobile Prototype)
INSERT INTO notifications (id, user_id, title, body, notification_type, is_read, metadata, created_at)
VALUES 
    (
        '55555555-5555-5555-5555-555555555551',
        '33333333-3333-3333-3333-333333333333',
        'Appointment Confirmed! 🎫',
        'Serial #04 assigned with Dr. Karim Chowdhury for today.',
        'booking_confirmed',
        false,
        '{"tokenNumber": 4, "doctorName": "Dr. Karim Chowdhury"}'::jsonb,
        CURRENT_TIMESTAMP - INTERVAL '10 minutes'
    ),
    (
        '55555555-5555-5555-5555-555555555552',
        '33333333-3333-3333-3333-333333333333',
        'Doctor Running 10m Late ⏳',
        'Due to a complex surgical case, chamber start is slightly delayed.',
        'queue_update',
        true,
        '{"delayMinutes": 10}'::jsonb,
        CURRENT_TIMESTAMP - INTERVAL '35 minutes'
    ),
    (
        '55555555-5555-5555-5555-555555555553',
        '33333333-3333-3333-3333-333333333333',
        'Doctor On 5-Min Break ☕',
        'Dr. Karim Chowdhury is on a quick break. Chamber is empty. Serial #03 next.',
        'doctor_break',
        true,
        '{"breakMinutes": 5}'::jsonb,
        CURRENT_TIMESTAMP - INTERVAL '1 hour'
    )
ON CONFLICT DO NOTHING;
