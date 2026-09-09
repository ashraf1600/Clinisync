import asyncio
import random
import uuid
import pytest
from httpx import AsyncClient
from app.core.config import settings


async def _register(client: AsyncClient, role: str, extra: dict | None = None) -> dict:
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "name": f"Conc {role} {suffix}",
        "email": f"conc_{role}_{suffix}@example.com",
        "password": "Password123!",
        "phone": "+880 1711-000000",
        "timezone": "Asia/Dhaka",
        "role": role,
        **(extra or {}),
    }
    if role == "doctor":
        payload.update({"specialization": "Cardiology", "bmdcNumber": f"BMDC-C{suffix[:5]}"})
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


async def _doctor_id_for(client: AsyncClient, name: str) -> str:
    res = await client.get("/api/v1/doctors", params={"search": name})
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert len(items) >= 1
    return items[0]["id"]


@pytest.mark.asyncio
async def test_concurrent_same_slot_single_winner(client: AsyncClient):
    """PRD pass criteria: N=50 simultaneous books, exactly 1x201 + 49x409, zero duplicates."""
    N = 50
    doctor = await _register(client, "doctor")
    doctor_id = await _doctor_id_for(client, doctor["user"]["name"])
    patient = await _register(client, "patient")
    token = patient["tokens"]["accessToken"]
    auth = {"Authorization": f"Bearer {token}"}

    day = random.randint(1, 28)
    target = f"2028-03-{day:02d}"
    payload = {
        "doctorId": doctor_id,
        "startTime": f"{target}T11:00:00Z",
        "endTime": f"{target}T11:30:00Z",
        "visitType": "new_consultation",
        "chiefComplaint": "Concurrency stress test",
    }

    async def one_book(i: int):
        headers = {**auth, "Idempotency-Key": str(uuid.uuid4())}
        return await client.post("/api/v1/appointments/book", headers=headers, json=payload)

    responses = await asyncio.gather(*[one_book(i) for i in range(N)])
    created = [r for r in responses if r.status_code == 201]
    conflicts = [r for r in responses if r.status_code == 409]

    assert len(created) == 1, f"expected exactly 1 winner, got {len(created)}"
    assert len(conflicts) == N - 1, f"expected {N-1} conflicts, got {len(conflicts)}"
    for r in conflicts:
        assert r.json()["error"]["code"] == "SLOT_CONFLICT"

    # Zero duplicate rows: the day queue holds exactly one appointment
    doc_login = await client.post(
        "/api/v1/auth/login",
        json={"email": doctor["user"]["email"], "password": "Password123!"},
    )
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['tokens']['accessToken']}"}
    queue = await client.get(f"/api/v1/appointments/doctor/{doctor_id}", params={"date": target}, headers=doc_headers)
    assert queue.status_code == 200, queue.text
    assert queue.json()["totalAppointments"] == 1


@pytest.mark.asyncio
async def test_reminder_cron_requires_secret(client: AsyncClient, monkeypatch):
    # No secret -> 401
    res = await client.post("/api/v1/notifications/send-reminders")
    assert res.status_code == 401

    # With configured secret -> 200 with run counts (empty DB windows are fine)
    monkeypatch.setattr(settings, "CRON_SECRET_KEY", "test-cron-secret")
    res2 = await client.post(
        "/api/v1/notifications/send-reminders", headers={"X-Cron-Secret": "test-cron-secret"}
    )
    assert res2.status_code == 200, res2.text
    body = res2.json()
    assert {"checked24h", "sent24h", "checked1h", "sent1h"} <= set(body.keys())


@pytest.mark.asyncio
async def test_verify_pass_rbac(client: AsyncClient):
    patient = await _register(client, "patient")
    doctor = await _register(client, "doctor")
    patient_headers = {"Authorization": f"Bearer {patient['tokens']['accessToken']}"}
    doctor_headers = {"Authorization": f"Bearer {doctor['tokens']['accessToken']}"}
    random_id = str(uuid.uuid4())

    # Patient role is forbidden even before existence is checked
    res = await client.get(f"/api/v1/appointments/{random_id}/verify", headers=patient_headers)
    assert res.status_code == 403

    # Doctor gets 404 for unknown id (proves role gate passed)
    res2 = await client.get(f"/api/v1/appointments/{random_id}/verify", headers=doctor_headers)
    assert res2.status_code == 404
