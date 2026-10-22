import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from typing import AsyncGenerator
from app.core.database import engine, Base

# Import all models so Base knows about all tables
# (before importing app.main: `import app.x.models` rebinds name `app` to the package)
from app.users import models as _users_models  # noqa: F401
from app.doctors import models as _doctors_models  # noqa: F401
from app.availability import models as _availability_models  # noqa: F401
from app.appointments import models as _appointments_models  # noqa: F401
from app.notifications import models as _notifications_models  # noqa: F401
from app.admin import models as _admin_models  # noqa: F401

from app.main import app

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
