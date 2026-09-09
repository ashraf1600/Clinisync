import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_admin_analytics_and_audit(client: AsyncClient):
    # Admin login
    login_res = await client.post("/api/v1/auth/login", json={"email": "admin@clinisync.com", "password": "AdminSecret123!"})
    assert login_res.status_code == 200
    token = login_res.json()["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Analytics
    analytics_res = await client.get("/api/v1/admin/analytics", headers=headers)
    assert analytics_res.status_code == 200
    data = analytics_res.json()
    assert "totalBookings" in data
    assert "activeDoctors" in data
    assert "noShowRatePercentage" in data

    # Audit log
    audit_res = await client.get("/api/v1/admin/audit-log", headers=headers)
    assert audit_res.status_code == 200
    assert "items" in audit_res.json()
