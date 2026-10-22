from datetime import date, datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
    DHAKA_TZ = ZoneInfo("Asia/Dhaka")
except Exception:
    # Fallback for containers without tzdata: fixed UTC+6 (no DST in Bangladesh)
    DHAKA_TZ = timezone(timedelta(hours=6))


def to_utc(dt: datetime) -> datetime:
    """Normalize a datetime to aware UTC (naive values are treated as UTC)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def dhaka_date(dt: datetime) -> date:
    """Clinic calendar date (Asia/Dhaka) of an instant."""
    return to_utc(dt).astimezone(DHAKA_TZ).date()


def dhaka_day_bounds_utc(target_date: date) -> tuple[datetime, datetime]:
    """UTC window covering one full Dhaka calendar day [00:00, next 00:00)."""
    start_local = datetime(target_date.year, target_date.month, target_date.day, tzinfo=DHAKA_TZ)
    start_utc = start_local.astimezone(timezone.utc)
    return start_utc, start_utc + timedelta(days=1)


def format_local(dt: datetime, fmt: str = "%b %d, %I:%M %p") -> str:
    """Human-readable Dhaka wall-clock time for notification text."""
    return to_utc(dt).astimezone(DHAKA_TZ).strftime(fmt)


def dhaka_wall_to_utc(target_date: date, t) -> datetime:
    """Interpret a chamber wall-clock TIME on a Dhaka calendar date as UTC.

    Chamber shift hours (e.g. 17:00-21:00) are stored as local wall-clock times.
    The API contract returns UTC ISO timestamps, so convert Dhaka -> UTC here.
    """
    local_dt = datetime(
        target_date.year, target_date.month, target_date.day,
        t.hour, t.minute, t.second, tzinfo=DHAKA_TZ,
    )
    return local_dt.astimezone(timezone.utc)
