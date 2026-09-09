import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_doctors_directory(client: AsyncClient):
    # Public listing
    res = await client.get("/api/v1/doctors")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "meta" in data
    assert data["meta"]["page"] == 1

    # Filter by specialization
    cardio_res = await client.get("/api/v1/doctors?specialization=Cardiology")
    assert cardio_res.status_code == 200
    for item in cardio_res.json()["items"]:
        assert item["specialization"].lower() == "cardiology"

    # Search query
    search_res = await client.get("/api/v1/doctors?search=Karim")
    assert search_res.status_code == 200
    assert len(search_res.json()["items"]) >= 1
