import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from typing import AsyncGenerator
from app.main import app
from app.core.database import engine, Base

# Import all models so Base knows about all tables
import app.users.models  # noqa
import app.doctors.models  # noqa
import app.availability.models  # noqa
import app.appointments.models  # noqa
import app.notifications.models  # noqa
import app.admin.models  # noqa

from sqlalchemy import text

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with engine.begin() as conn:
        try:
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "btree_gist";'))
        except Exception as e:
            print("Extension creation note:", e)
        await conn.run_sync(Base.metadata.create_all)
    yield

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
