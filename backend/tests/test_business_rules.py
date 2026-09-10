import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def _make_user(client: AsyncClient, role="patient", **extra):
    s = uuid.uuid4().hex[:8]
    payload = {
        "name": f"Biz {role} {s}",
        "email": f"biz_{role}_{s}@example.com",
        "password": "Password123!",
        "phone": "+8801711000000",
        "timezone": "Asia/Dhaka",
        "role": role,
        **extra,
    }
    if role == "doctor":
        payload.setdefault("specialization", "Cardiology")
        payload.setdefault("bmdcNumber", f"BMDC-B{s[:5]}")
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, res.text
    j = res.json()
    return j["user"], j["tokens"]["accessToken"]

async def _doctor_id(client: AsyncClient, token: str, name: str) -> str:
    res = await client.get("/api/v1/doctors", params={"search": name}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for it in res.json()["items"]:
        if it["name"] == name:
            return it["id"]
    return res.json()["items"][0]["id"]

async def test_book_past_rejected(client: AsyncClient):
    user, tok = await _make_user(client, "patient")
    doc_user, doc_tok = await _make_user(client, "doctor")
    did = await _doctor_id(client, doc_tok, doc_user["name"])
    headers = {"Authorization": f"Bearer {tok}", "Idempotency-Key": str(uuid.uuid4())}
    # Far past
    res = await client.post("/api/v1/appointments/book", headers=headers, json={
        "doctorId": did, "startTime": "2000-01-01T10:00:00Z", "endTime": "2000-01-01T10:30:00Z",
        "visitType": "new_consultation", "chiefComplaint": "past"
    })
    assert res.status_code == 400, res.text
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"

async def test_cancel_ownership(client: AsyncClient):
    pat_user, pat_tok = await _make_user(client, "patient")
    other_user, other_tok = await _make_user(client, "patient")
    admin_user, admin_tok = await _make_user(client, "admin")
    doc_user, doc_tok = await _make_user(client, "doctor")
    did = await _doctor_id(client, doc_tok, doc_user["name"])
    # Book with pat
    h = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    import random
    d = random.randint(10, 20)
    day = f"2029-05-{d:02d}"
    book = await client.post("/api/v1/appointments/book", headers=h, json={
        "doctorId": did, "startTime": f"{day}T10:00:00Z", "endTime": f"{day}T10:30:00Z"
    })
    assert book.status_code == 201, book.text
    appt_id = book.json()["id"]

    # Other patient cannot cancel
    res = await client.put(f"/api/v1/appointments/{appt_id}/cancel", headers={"Authorization": f"Bearer {other_tok}"}, json={"reason": "no"})
    assert res.status_code == 403, res.text

    # Admin can cancel (book again with new id for this check)
    h2 = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    day2 = f"2029-05-{d+1:02d}"
    book2 = await client.post("/api/v1/appointments/book", headers=h2, json={
        "doctorId": did, "startTime": f"{day2}T10:00:00Z", "endTime": f"{day2}T10:30:00Z"
    })
    assert book2.status_code == 201
    appt2 = book2.json()["id"]
    res_admin = await client.put(f"/api/v1/appointments/{appt2}/cancel", headers={"Authorization": f"Bearer {admin_tok}"}, json={"reason": "admin override"})
    assert res_admin.status_code == 200, res_admin.text
    assert res_admin.json()["status"] == "cancelled"

    # Already-cancelled -> 400
    res2 = await client.put(f"/api/v1/appointments/{appt2}/cancel", headers={"Authorization": f"Bearer {admin_tok}"}, json={"reason": "again"})
    assert res2.status_code == 400

async def test_reschedule_same_slot_rejected(client: AsyncClient):
    pat_user, pat_tok = await _make_user(client, "patient")
    doc_user, doc_tok = await _make_user(client, "doctor")
    did = await _doctor_id(client, doc_tok, doc_user["name"])
    import random
    d = random.randint(21, 27)
    day = f"2029-06-{d:02d}"
    h = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    book = await client.post("/api/v1/appointments/book", headers=h, json={
        "doctorId": did, "startTime": f"{day}T09:00:00Z", "endTime": f"{day}T09:30:00Z"
    })
    assert book.status_code == 201
    appt = book.json()
    res = await client.put(f"/api/v1/appointments/{appt['id']}/reschedule",
        headers={"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())},
        json={"newStartTime": appt["startTime"], "newEndTime": appt["endTime"]})
    assert res.status_code == 400, res.text

async def test_reschedule_retoken_new_day(client: AsyncClient):
    pat_user, pat_tok = await _make_user(client, "patient")
    doc_user, doc_tok = await _make_user(client, "doctor")
    did = await _doctor_id(client, doc_tok, doc_user["name"])
    import random
    d = random.randint(1, 8)
    day1 = f"2030-01-{d:02d}"
    day2 = f"2030-01-{d+5:02d}"
    # Book on day1 -> token 1
    h1 = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    b1 = await client.post("/api/v1/appointments/book", headers=h1, json={
        "doctorId": did, "startTime": f"{day1}T10:00:00Z", "endTime": f"{day1}T10:30:00Z"
    })
    assert b1.status_code == 201
    t1 = b1.json()["tokenNumber"]
    assert t1 == 1
    appt_id = b1.json()["id"]
    # Book another patient on day2 to occupy token 1 there
    pat2_user, pat2_tok = await _make_user(client, "patient")
    h_other = {"Authorization": f"Bearer {pat2_tok}", "Idempotency-Key": str(uuid.uuid4())}
    b_other = await client.post("/api/v1/appointments/book", headers=h_other, json={
        "doctorId": did, "startTime": f"{day2}T10:00:00Z", "endTime": f"{day2}T10:30:00Z"
    })
    assert b_other.status_code == 201
    assert b_other.json()["tokenNumber"] == 1
    # Reschedule first appt from day1 to day2 11:00 -> should become token 2
    res = await client.put(f"/api/v1/appointments/{appt_id}/reschedule",
        headers={"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())},
        json={"newStartTime": f"{day2}T11:00:00Z", "newEndTime": f"{day2}T11:30:00Z"})
    assert res.status_code == 200, res.text
    assert res.json()["tokenNumber"] == 2

async def test_followup_fee(client: AsyncClient):
    pat_user, pat_tok = await _make_user(client, "patient")
    doc_user, doc_tok = await _make_user(client, "doctor")
    did = await _doctor_id(client, doc_tok, doc_user["name"])
    import random
    d = random.randint(1, 8)
    day = f"2031-02-{d:02d}"
    h = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    res = await client.post("/api/v1/appointments/book", headers=h, json={
        "doctorId": did, "startTime": f"{day}T10:00:00Z", "endTime": f"{day}T10:30:00Z", "visitType": "followup"
    })
    assert res.status_code == 201, res.text
    # Doctor default followup fee is 600, consultation 1000
    assert res.json()["fee"] == 600.0 or res.json()["fee"] == 600

    # new_consultation should be 1000
    h2 = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    day2 = f"2031-02-{d+10:02d}"
    res2 = await client.post("/api/v1/appointments/book", headers=h2, json={
        "doctorId": did, "startTime": f"{day2}T10:00:00Z", "endTime": f"{day2}T10:30:00Z", "visitType": "new_consultation"
    })
    assert res2.status_code == 201
    assert res2.json()["fee"] == 1000.0 or res2.json()["fee"] == 1000

async def test_update_status_wrong_doctor_forbidden(client: AsyncClient):
    pat_user, pat_tok = await _make_user(client, "patient")
    docA_user, docA_tok = await _make_user(client, "doctor")
    docB_user, docB_tok = await _make_user(client, "doctor")
    didA = await _doctor_id(client, docA_tok, docA_user["name"])
    h = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    import random
    d = random.randint(15, 25)
    day = f"2032-03-{d:02d}"
    book = await client.post("/api/v1/appointments/book", headers=h, json={
        "doctorId": didA, "startTime": f"{day}T10:00:00Z", "endTime": f"{day}T10:30:00Z"
    })
    assert book.status_code == 201
    appt_id = book.json()["id"]
    # Doctor B tries to update -> 403
    res = await client.put(f"/api/v1/appointments/{appt_id}/status", headers={"Authorization": f"Bearer {docB_tok}"}, json={"status": "completed"})
    assert res.status_code == 403, res.text
    # Doctor A succeeds
    res_ok = await client.put(f"/api/v1/appointments/{appt_id}/status", headers={"Authorization": f"Bearer {docA_tok}"}, json={"status": "completed"})
    assert res_ok.status_code == 200

async def test_doctor_receives_notification_on_book(client: AsyncClient):
    pat_user, pat_tok = await _make_user(client, "patient")
    doc_user, doc_tok = await _make_user(client, "doctor")
    did = await _doctor_id(client, doc_tok, doc_user["name"])
    import random
    d = random.randint(5, 15)
    day = f"2033-04-{d:02d}"
    h = {"Authorization": f"Bearer {pat_tok}", "Idempotency-Key": str(uuid.uuid4())}
    book = await client.post("/api/v1/appointments/book", headers=h, json={
        "doctorId": did, "startTime": f"{day}T10:00:00Z", "endTime": f"{day}T10:30:00Z"
    })
    assert book.status_code == 201
    # Doctor inbox should have a booking notification
    res = await client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {doc_tok}"})
    assert res.status_code == 200
    items = res.json()["items"]
    # At least one notification for the doctor exists (the new booking)
    assert any("New Booking" in it["title"] or "Booking" in it["title"] for it in items), items
