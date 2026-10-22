"""Regression tests for business-rule fixes from the backend audit."""
import random
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _make_user(client: AsyncClient, role="patient", **extra):
    s = uuid.uuid4().hex[:8]
    payload = {
        "name": f"Audit {role} {s}",
        "email": f"audit_{role}_{s}@example.com",
        "password": "Password123!",
        "timezone": "Asia/Dhaka",
        "role": role,
        **extra,
    }
    if role == "doctor":
        payload.setdefault("specialization", "Cardiology")
        payload.setdefault("bmdcNumber", f"BMDC-X{s[:5]}")
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, res.text
    j = res.json()
    return j["user"], j["tokens"]["accessToken"]


async def _make_doctor(client: AsyncClient):
    user, tok = await _make_user(client, "doctor")
    res = await client.get("/api/v1/doctors/me", headers=_auth(tok))
    assert res.status_code == 200, res.text
    return user, tok, res.json()["id"]


def _auth(tok: str, idem: bool = False) -> dict:
    h = {"Authorization": f"Bearer {tok}"}
    if idem:
        h["Idempotency-Key"] = str(uuid.uuid4())
    return h


def _day(year: int) -> str:
    return f"{year}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"


async def _book(client, tok, did, start, end, headers=None, **extra):
    return await client.post(
        "/api/v1/appointments/book",
        headers=headers or _auth(tok, idem=True),
        json={"doctorId": did, "startTime": start, "endTime": end, **extra},
    )


async def test_idempotency_key_scoped_to_patient(client: AsyncClient):
    _, pat_tok = await _make_user(client)
    _, other_tok = await _make_user(client)
    _, _, did = await _make_doctor(client)
    day = _day(2034)
    headers = _auth(pat_tok, idem=True)

    first = await _book(client, pat_tok, did, f"{day}T11:00:00Z", f"{day}T11:30:00Z", headers=headers)
    assert first.status_code == 201, first.text

    # Same patient replaying the same key gets the same booking back (no 500, no duplicate)
    replay = await _book(client, pat_tok, did, f"{day}T11:00:00Z", f"{day}T11:30:00Z", headers=headers)
    assert replay.status_code == 201, replay.text
    assert replay.json()["id"] == first.json()["id"]
    assert replay.json()["doctorName"]

    # Another patient cannot read someone else's booking through the key
    hijack = await _book(
        client, other_tok, did, f"{day}T11:00:00Z", f"{day}T11:30:00Z",
        headers={**_auth(other_tok), "Idempotency-Key": headers["Idempotency-Key"]},
    )
    assert hijack.status_code == 409
    assert hijack.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


async def test_patient_cannot_double_book_same_doctor_day(client: AsyncClient):
    _, pat_tok = await _make_user(client)
    _, _, did = await _make_doctor(client)
    day = _day(2035)
    ok = await _book(client, pat_tok, did, f"{day}T11:00:00Z", f"{day}T11:30:00Z")
    assert ok.status_code == 201, ok.text
    dup = await _book(client, pat_tok, did, f"{day}T12:20:00Z", f"{day}T12:50:00Z")
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "PATIENT_DOUBLE_BOOKING"


async def test_booking_respects_configured_shifts_and_holidays(client: AsyncClient):
    _, pat_tok = await _make_user(client)
    _, doc_tok, did = await _make_doctor(client)

    # 09:00-12:00 Dhaka every day, zero buffer
    shifts = await client.post(
        f"/api/v1/availability/{did}/shifts",
        headers=_auth(doc_tok),
        json={"daysOfWeek": [0, 1, 2, 3, 4, 5, 6], "startTime": "09:00", "endTime": "12:00",
              "slotDurationMinutes": 30, "bufferMinutes": 0},
    )
    assert shifts.status_code == 201, shifts.text

    day = _day(2036)
    # A zero buffer must be honoured (it used to silently become 10 minutes)
    slots = (await client.get(f"/api/v1/availability/{did}", params={"date": day})).json()["slots"]
    assert len(slots) == 6
    assert slots[0]["startTime"] == f"{day}T03:00:00Z"  # 09:00 Dhaka

    # 14:00 Dhaka is outside the chamber hours
    outside = await _book(client, pat_tok, did, f"{day}T08:00:00Z", f"{day}T08:30:00Z")
    assert outside.status_code == 400
    assert outside.json()["error"]["code"] == "SLOT_UNAVAILABLE"

    # Doctor blocks the day -> bookings rejected, schedule shows it as off
    exc = await client.post(f"/api/v1/availability/{did}/exceptions", headers=_auth(doc_tok),
                            json={"exceptionDate": day, "isAvailable": False, "reason": "Conference"})
    assert exc.status_code == 201, exc.text
    blocked = await _book(client, pat_tok, did, f"{day}T03:00:00Z", f"{day}T03:30:00Z")
    assert blocked.status_code == 400
    assert blocked.json()["error"]["code"] == "SLOT_UNAVAILABLE"

    # Invalid shift windows are rejected instead of crashing with a DB error
    bad = await client.post(
        f"/api/v1/availability/{did}/shifts", headers=_auth(doc_tok),
        json={"daysOfWeek": [1], "startTime": "12:00", "endTime": "09:00"},
    )
    assert bad.status_code == 422


async def test_status_transitions_enforced(client: AsyncClient):
    _, pat_tok = await _make_user(client)
    _, doc_tok, did = await _make_doctor(client)
    day = _day(2037)
    book = await _book(client, pat_tok, did, f"{day}T11:00:00Z", f"{day}T11:30:00Z")
    assert book.status_code == 201, book.text
    appt_id = book.json()["id"]

    # Cannot mark a future visit as no-show or completed
    res = await client.put(f"/api/v1/appointments/{appt_id}/status", headers=_auth(doc_tok), json={"status": "no_show"})
    assert res.status_code == 400
    res = await client.put(f"/api/v1/appointments/{appt_id}/status", headers=_auth(doc_tok), json={"status": "completed"})
    assert res.status_code == 400

    # Cancelled is terminal: it cannot be revived into a possibly double-booked slot
    res = await client.put(f"/api/v1/appointments/{appt_id}/status", headers=_auth(doc_tok), json={"status": "cancelled"})
    assert res.status_code == 200, res.text
    res = await client.put(f"/api/v1/appointments/{appt_id}/status", headers=_auth(doc_tok), json={"status": "confirmed"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    # Unknown status is rejected by validation
    res = await client.put(f"/api/v1/appointments/{appt_id}/status", headers=_auth(doc_tok), json={"status": "teleported"})
    assert res.status_code == 422


async def test_doctor_cannot_manage_another_doctors_chamber(client: AsyncClient):
    _, pat_tok = await _make_user(client)
    _, docA_tok, didA = await _make_doctor(client)
    _, docB_tok, _ = await _make_doctor(client)
    day = _day(2038)

    res = await client.put(f"/api/v1/appointments/doctor/{didA}/queue-pause", headers=_auth(docB_tok), json={"pauseMinutes": 5})
    assert res.status_code == 403
    res = await client.put(f"/api/v1/appointments/doctor/{didA}/queue-resume", headers=_auth(docB_tok))
    assert res.status_code == 403

    walk_in = {"doctorId": didA, "patientName": "Walk In", "startTime": f"{day}T11:00:00Z", "endTime": f"{day}T11:30:00Z"}
    res = await client.post("/api/v1/appointments/walk-in", headers=_auth(docB_tok), json=walk_in)
    assert res.status_code == 403
    res = await client.post("/api/v1/appointments/walk-in", headers=_auth(docA_tok), json=walk_in)
    assert res.status_code == 201, res.text

    # Another doctor sees the queue masked; the treating doctor sees full details
    book = await _book(client, pat_tok, didA, f"{day}T12:20:00Z", f"{day}T12:50:00Z", chiefComplaint="Chest pain")
    assert book.status_code == 201, book.text
    other_view = (await client.get(f"/api/v1/appointments/doctor/{didA}", params={"date": day}, headers=_auth(docB_tok))).json()
    own_view = (await client.get(f"/api/v1/appointments/doctor/{didA}", params={"date": day}, headers=_auth(docA_tok))).json()
    assert all(i["chiefComplaint"] == "🔒 Clinical Problem Masked" for i in other_view["items"])
    assert any(i["chiefComplaint"] == "Chest pain" for i in own_view["items"])

    # Verifying a pass from another doctor's chamber is forbidden
    res = await client.get(f"/api/v1/appointments/{book.json()['id']}/verify", headers=_auth(docB_tok))
    assert res.status_code == 403


async def test_walk_in_does_not_rename_registered_user(client: AsyncClient):
    phone = f"+8801{random.randint(100000000, 999999999)}"
    pat_user, _ = await _make_user(client, phone=phone)
    _, doc_tok, did = await _make_doctor(client)
    day = _day(2039)
    res = await client.post(
        "/api/v1/appointments/walk-in", headers=_auth(doc_tok),
        json={"doctorId": did, "patientName": "Somebody Else", "patientPhone": phone,
              "startTime": f"{day}T11:00:00Z", "endTime": f"{day}T11:30:00Z"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["patientId"] == pat_user["id"]
    assert res.json()["patientName"] == pat_user["name"]


async def test_reschedule_by_non_owner_forbidden(client: AsyncClient):
    _, pat_tok = await _make_user(client)
    _, other_tok = await _make_user(client)
    _, _, did = await _make_doctor(client)
    day = _day(2040)
    book = await _book(client, pat_tok, did, f"{day}T11:00:00Z", f"{day}T11:30:00Z")
    assert book.status_code == 201, book.text
    res = await client.put(
        f"/api/v1/appointments/{book.json()['id']}/reschedule", headers=_auth(other_tok, idem=True),
        json={"newStartTime": f"{day}T12:20:00Z", "newEndTime": f"{day}T12:50:00Z"},
    )
    assert res.status_code == 403


async def test_malformed_token_subject_is_401(client: AsyncClient):
    from app.core.security import create_access_token
    token = create_access_token("not-a-uuid", "patient")
    res = await client.get("/api/v1/users/me", headers=_auth(token))
    assert res.status_code == 401
