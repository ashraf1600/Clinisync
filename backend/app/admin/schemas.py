import uuid
from datetime import datetime
from typing import List, Optional, Any, Dict
from app.core.base_schema import CamelModel

class AdminAnalyticsResponse(CamelModel):
    total_bookings: int
    completed_count: int
    no_show_count: int
    cancelled_count: int
    no_show_rate_percentage: float
    active_doctors: int
    registered_patients: int

class AuditLogItem(CamelModel):
    id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    action: str
    target_type: str
    target_id: Optional[uuid.UUID] = None
    metadata: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    timestamp: datetime

class AuditLogListResponse(CamelModel):
    items: List[AuditLogItem]
    page: int
    page_size: int
    total_count: int
