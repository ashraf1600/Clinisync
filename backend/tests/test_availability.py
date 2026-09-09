import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_doctor_availability_slots(client: AsyncClient):
    # Fetch doctor ID from directory
    docs_res = await client.get("/api/v1/doctors")
    assert docs_res.status_code == 200
    doctor_id = docs_res.json()["items"][0]["id"]

    # Query availability for Sunday 2026-09-13
    avail_res = await client.get(f"/api/v1/availability/{doctor_id}?date=2026-09-13")
    assert avail_res.status_code == 200
    data = avail_res.json()
    assert data["date"] == "2026-09-13"
    assert "slots" in data
    assert data["slotDurationMinutes"] == 30

@pytest.mark.asyncio
async def test_bulk_generate_slots(client: AsyncClient):
    # Login as admin to get token
    login_res = await client.post("/api/v1/auth/login", json={"email": "admin@clinisync.com", "password": "AdminSecret123!"})
    assert login_res.status_code == 200
    token = login_res.json()["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    docs_res = await client.get("/api/v1/doctors")
    doctor_id = docs_res.json()["items"][0]["id"]

    bulk_payload = {
        "targetRange": "month",
        "startDate": "2026-10-01",
        "endDate": "2026-10-31",
        "daysOfWeek": [0, 1, 2, 3, 4, 6],
        "startTime": "09:00",
        "endTime": "13:00",
        "slotDurationMinutes": 30,
        "bufferMinutes": 10,
        "applyHolidays": True
    }
    res = await client.post(f"/api/v1/availability/{doctor_id}/bulk-generate", headers=headers, json=bulk_payload)
    assert res.status_code == 201
    assert "totalSlotsCreated" in res.json()


@pytest.mark.asyncio
async def test_add_and_list_chamber_shifts(client: AsyncClient):
    # Login as admin
    login_res = await client.post("/api/v1/auth/login", json={"email": "admin@clinisync.com", "password": "AdminSecret123!"})
    assert login_res.status_code == 200
    token = login_res.json()["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    docs_res = await client.get("/api/v1/doctors")
    doctor = docs_res.json()["items"][0]
    doctor_id = doctor["id"]
    locations = doctor["locations"]
    location_id = locations[0]["id"] if locations else None

    # Add slot time shift for this chamber
    payload = {
        "locationId": location_id,
        "daysOfWeek": [6, 1], # Saturday and Monday
        "startTime": "18:00",
        "endTime": "20:00",
        "slotDurationMinutes": 20,
        "bufferMinutes": 5,
        "isActive": True
    }
    create_res = await client.post(f"/api/v1/availability/{doctor_id}/shifts", headers=headers, json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert len(created) == 2
    assert created[0]["startTime"] == "18:00"
    assert created[0]["slotDurationMinutes"] == 20
    first_shift_id = created[0]["id"]

    # List shifts for this doctor and chamber
    list_res = await client.get(f"/api/v1/availability/{doctor_id}/shifts?locationId={location_id}")
    assert list_res.status_code == 200
    shifts = list_res.json()
    assert any(s["id"] == first_shift_id for s in shifts)

    # Delete the created shift
    del_res = await client.delete(f"/api/v1/availability/{doctor_id}/shifts/{first_shift_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify deleted
    list_res_after = await client.get(f"/api/v1/availability/{doctor_id}/shifts?locationId={location_id}")
    assert not any(s["id"] == first_shift_id for s in list_res_after.json())


@pytest.mark.asyncio
async def test_admin_create_doctor_chamber_location(client: AsyncClient):
    # Login as admin
    login_res = await client.post("/api/v1/auth/login", json={"email": "admin@clinisync.com", "password": "AdminSecret123!"})
    token = login_res.json()["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    docs_res = await client.get("/api/v1/doctors")
    doctor_id = docs_res.json()["items"][0]["id"]

    # Create new chamber location for doctor
    new_chamber_payload = {
        "facilityName": "United Hospital Dhaka",
        "branchArea": "Gulshan 2",
        "chamberRoom": "Room #512",
        "address": "Plot 15, Road 71, Gulshan, Dhaka",
        "contactPhone": "+880 1711-999888",
        "isActive": True
    }
    create_res = await client.post(f"/api/v1/doctors/{doctor_id}/locations", headers=headers, json=new_chamber_payload)
    assert create_res.status_code == 201
    created_loc = create_res.json()
    assert created_loc["facilityName"] == "United Hospital Dhaka"
    loc_id = created_loc["id"]

    # Add slot time specifically for this newly created chamber
    shift_payload = {
        "locationId": loc_id,
        "daysOfWeek": [2, 4], # Tuesday and Thursday
        "startTime": "09:30",
        "endTime": "12:30",
        "slotDurationMinutes": 15,
        "bufferMinutes": 5,
        "isActive": True
    }
    shift_res = await client.post(f"/api/v1/availability/{doctor_id}/shifts", headers=headers, json=shift_payload)
    assert shift_res.status_code == 201
    shifts = shift_res.json()
    assert len(shifts) == 2
    assert shifts[0]["facilityName"] == "United Hospital Dhaka"
    assert shifts[0]["chamberRoom"] == "Room #512"


@pytest.mark.asyncio
async def test_doctor_multi_day_schedule(client: AsyncClient):
    # Fetch doctor
    docs_res = await client.get("/api/v1/doctors")
    assert docs_res.status_code == 200
    doctor_id = docs_res.json()["items"][0]["id"]

    # Query 14-day schedule
    schedule_res = await client.get(f"/api/v1/availability/{doctor_id}/schedule?days=14")
    assert schedule_res.status_code == 200
    data = schedule_res.json()

    assert data["doctorId"] == doctor_id
    assert "sittingDays" in data
    assert "sittingHours" in data
    assert "days" in data
    assert len(data["days"]) == 14

    # Verify first day format
    first_day = data["days"][0]
    assert "date" in first_day
    assert "dayName" in first_day
    assert "dayNameBn" in first_day
    assert "isToday" in first_day
    assert first_day["isToday"] is True
    assert "slots" in first_day
    assert "availableCount" in first_day
    assert "status" in first_day
    assert first_day["status"] in ["available", "full", "off"]


