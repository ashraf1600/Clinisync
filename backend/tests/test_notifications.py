import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_notifications_lifecycle(client: AsyncClient):
    # Login patient
    login_res = await client.post("/api/v1/auth/login", json={"email": "patient@example.com", "password": "Password123!"})
    assert login_res.status_code == 200
    token = login_res.json()["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Register FCM token
    fcm_payload = {
        "fcmToken": "fcm_test_token_12345",
        "deviceType": "android",
        "deviceModel": "Pixel 7 Pro"
    }
    dev_res = await client.post("/api/v1/devices/fcm-token", headers=headers, json=fcm_payload)
    assert dev_res.status_code == 200
    assert dev_res.json()["isActive"] is True

    # 2. Get notifications feed
    notif_res = await client.get("/api/v1/notifications", headers=headers)
    assert notif_res.status_code == 200
    data = notif_res.json()
    assert "items" in data
    assert "unreadCount" in data

    if data["items"]:
        first_id = data["items"][0]["id"]
        # Mark single read
        read_res = await client.patch(f"/api/v1/notifications/{first_id}/read", headers=headers)
        assert read_res.status_code == 200
        assert read_res.json()["isRead"] is True

    # 3. Mark all read
    mark_all_res = await client.post("/api/v1/notifications/mark-all-read", headers=headers)
    assert mark_all_res.status_code == 200
    assert mark_all_res.json()["success"] is True
