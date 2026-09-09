import pytest
import uuid
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_appointment_booking_and_queue_flow(client: AsyncClient):
    # 1. Login patient
    login_res = await client.post("/api/v1/auth/login", json={"email": "patient@example.com", "password": "Password123!"})
    assert login_res.status_code == 200
    patient_token = login_res.json()["tokens"]["accessToken"]
    patient_headers = {
        "Authorization": f"Bearer {patient_token}",
        "Idempotency-Key": str(uuid.uuid4())
    }

    # 2. Get Doctor ID
    docs_res = await client.get("/api/v1/doctors")
    doctor_id = docs_res.json()["items"][0]["id"]

    # 3. Book slot with unique future date
    import random
    rand_day = random.randint(1, 28)
    rand_month = random.randint(1, 12)
    rand_hour = random.randint(9, 16)
    target_date_str = f"2027-{rand_month:02d}-{rand_day:02d}"
    start_time_str = f"{target_date_str}T{rand_hour:02d}:00:00Z"
    end_time_str = f"{target_date_str}T{rand_hour:02d}:30:00Z"

    book_payload = {
        "doctorId": doctor_id,
        "startTime": start_time_str,
        "endTime": end_time_str,
        "visitType": "new_consultation",
        "chiefComplaint": "Chest tightness and dyspnea for 3 days."
    }
    book_res = await client.post("/api/v1/appointments/book", headers=patient_headers, json=book_payload)
    assert book_res.status_code == 201
    appt_data = book_res.json()
    assert appt_data["tokenNumber"] >= 1
    assert appt_data["status"] == "confirmed"
    assert appt_data["paymentStatus"] == "pay_at_chamber"
    appt_id = appt_data["id"]

    # 4. Conflict Check: Booking the exact same slot must throw 409 Conflict
    conflict_headers = {
        "Authorization": f"Bearer {patient_token}",
        "Idempotency-Key": str(uuid.uuid4())
    }
    conflict_res = await client.post("/api/v1/appointments/book", headers=conflict_headers, json=book_payload)
    assert conflict_res.status_code == 409
    assert conflict_res.json()["error"]["code"] == "SLOT_CONFLICT"

    # 5. Doctor Login and Chamber Queue view
    doc_login = await client.post("/api/v1/auth/login", json={"email": "doctor.rahman@example.com", "password": "Password123!"})
    assert doc_login.status_code == 200
    doc_token = doc_login.json()["tokens"]["accessToken"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    queue_res = await client.get(f"/api/v1/appointments/doctor/{doctor_id}?date={target_date_str}", headers=doc_headers)
    assert queue_res.status_code == 200
    assert queue_res.json()["totalAppointments"] >= 1

    # 6. Patient my appointments
    my_appts = await client.get("/api/v1/appointments/patient/me?filter=upcoming", headers=patient_headers)
    assert my_appts.status_code == 200
    assert len(my_appts.json()) >= 1

    # 7. Doctor Queue Pause (Enforce Empty Chamber Invariant)

    pause_res = await client.put(
        f"/api/v1/appointments/doctor/{doctor_id}/queue-pause",
        headers=doc_headers,
        json={"pauseMinutes": 5, "reason": "Short break"}
    )
    assert pause_res.status_code == 200
    assert pause_res.json()["isPaused"] is True
    assert pause_res.json()["chamberStatus"] == "EMPTY (BREAK)"

    # 8. Doctor Queue Resume
    resume_res = await client.put(f"/api/v1/appointments/doctor/{doctor_id}/queue-resume", headers=doc_headers)
    assert resume_res.status_code == 200
    assert resume_res.json()["isPaused"] is False
    assert resume_res.json()["chamberStatus"] == "ACTIVE"

    # 9. Cancel Appointment
    cancel_res = await client.put(
        f"/api/v1/appointments/{appt_id}/cancel",
        headers=patient_headers,
        json={"reason": "Schedule clash"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
