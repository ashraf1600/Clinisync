"""Shared key-value store for state that must be consistent across workers.

Uses Redis (REDIS_URL) when reachable. If Redis is not configured or is down,
falls back to per-process memory so local development and tests keep working;
in that mode state is NOT shared between workers.
"""
import json
import logging
import time
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

# After a failed Redis call, use memory for this long before retrying Redis
_RETRY_AFTER_SECONDS = 30


class SharedStore:
    def __init__(self, url: str):
        self._url = url
        self._client = None
        self._down_until = 0.0
        self._memory: dict[str, tuple[Any, Optional[float]]] = {}

    # ------------------------------------------------------------- backend

    def _redis(self):
        if not self._url or time.monotonic() < self._down_until:
            return None
        if self._client is None:
            import redis.asyncio as redis
            self._client = redis.from_url(
                self._url, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5
            )
        return self._client

    def _mark_down(self, exc: Exception) -> None:
        if self._down_until <= time.monotonic():
            logger.warning(f"Redis unavailable ({exc}); using per-process memory for shared state")
        self._down_until = time.monotonic() + _RETRY_AFTER_SECONDS

    def _mem_get(self, key: str) -> Any:
        item = self._memory.get(key)
        if item is None:
            return None
        value, expires_at = item
        if expires_at is not None and expires_at <= time.monotonic():
            self._memory.pop(key, None)
            return None
        return value

    def _mem_set(self, key: str, value: Any, ttl_seconds: Optional[int]) -> None:
        expires_at = time.monotonic() + ttl_seconds if ttl_seconds else None
        self._memory[key] = (value, expires_at)
        if len(self._memory) > 10_000:
            # Drop expired entries so abandoned keys (e.g. one-off IPs) cannot grow without bound
            now = time.monotonic()
            self._memory = {k: v for k, v in self._memory.items() if v[1] is None or v[1] > now}

    # ------------------------------------------------------------- API

    async def get_json(self, key: str) -> Any:
        client = self._redis()
        if client is not None:
            try:
                raw = await client.get(key)
                return json.loads(raw) if raw is not None else None
            except Exception as exc:
                self._mark_down(exc)
        return self._mem_get(key)

    async def set_json(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        client = self._redis()
        if client is not None:
            try:
                await client.set(key, json.dumps(value), ex=ttl_seconds)
                return
            except Exception as exc:
                self._mark_down(exc)
        self._mem_set(key, value, ttl_seconds)

    async def delete(self, key: str) -> None:
        client = self._redis()
        if client is not None:
            try:
                await client.delete(key)
                return
            except Exception as exc:
                self._mark_down(exc)
        self._memory.pop(key, None)

    async def get_int(self, key: str) -> int:
        value = await self.get_json(key)
        return int(value) if value is not None else 0

    async def incr(self, key: str, ttl_seconds: int) -> int:
        """Increment a counter; the TTL starts with the first increment (fixed window)."""
        client = self._redis()
        if client is not None:
            try:
                count = await client.incr(key)
                if count == 1:
                    await client.expire(key, ttl_seconds)
                return int(count)
            except Exception as exc:
                self._mark_down(exc)
        item = self._memory.get(key)
        current = self._mem_get(key) or 0
        expires_at = item[1] if item and current else None
        remaining = int(expires_at - time.monotonic()) if expires_at else ttl_seconds
        self._mem_set(key, current + 1, max(remaining, 1))
        return current + 1

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None


shared_store = SharedStore(settings.REDIS_URL)
