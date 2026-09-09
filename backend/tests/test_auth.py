import pytest
import uuid
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    random_suffix = uuid.uuid4().hex[:6]
    test_email = f"patient_{random_suffix}@example.com"
    
    # 1. Register
    reg_payload = {
        "name": "Test Patient",
        "email": test_email,
        "password": "Password123!",
        "phone": "+880 1711-000000",
        "timezone": "Asia/Dhaka"
    }
    res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["email"] == test_email
    assert data["user"]["role"] == "patient"
    assert "accessToken" in data["tokens"]
    access_token = data["tokens"]["accessToken"]
    refresh_token = data["tokens"]["refreshToken"]

    # 2. Login
    login_payload = {
        "email": test_email,
        "password": "Password123!"
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    assert "accessToken" in login_res.json()["tokens"]

    # 3. Refresh token
    refresh_res = await client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})
    assert refresh_res.status_code == 200
    assert "accessToken" in refresh_res.json()

    # 4. Get Profile (/users/me)
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = await client.get("/api/v1/users/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == test_email

    # 5. Update Profile
    update_res = await client.put("/api/v1/users/me", headers=headers, json={"name": "Updated Patient Name"})
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Patient Name"

@pytest.mark.asyncio
async def test_forgot_and_reset_password(client: AsyncClient):
    res1 = await client.post("/api/v1/auth/forgot-password", json={"email": "patient@example.com"})
    assert res1.status_code == 200
    assert "message" in res1.json()

    res2 = await client.post("/api/v1/auth/reset-password", json={"token": "test-token", "newPassword": "NewPassword123!"})
    assert res2.status_code == 200
    assert "message" in res2.json()

@pytest.mark.asyncio
async def test_register_with_roles(client: AsyncClient):
    doc_suffix = uuid.uuid4().hex[:6]
    doc_email = f"doc_{doc_suffix}@example.com"
    doc_res = await client.post("/api/v1/auth/register", json={
        "name": "Dr. Registered",
        "email": doc_email,
        "password": "DoctorPass123!",
        "role": "doctor",
        "specialization": "Cardiology",
        "phone": "+880 1711-111222"
    })
    assert doc_res.status_code == 201
    assert doc_res.json()["user"]["role"] == "doctor"

    admin_suffix = uuid.uuid4().hex[:6]
    admin_email = f"admin_{admin_suffix}@example.com"
    admin_res = await client.post("/api/v1/auth/register", json={
        "name": "Admin Registered",
        "email": admin_email,
        "password": "AdminPass123!",
        "role": "admin",
        "phone": "+880 1711-333444"
    })
    assert admin_res.status_code == 201
    assert admin_res.json()["user"]["role"] == "admin"
