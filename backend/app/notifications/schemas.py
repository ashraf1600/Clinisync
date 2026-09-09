import uuid
from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import Field
from app.core.base_schema import CamelModel

class DeviceRegisterRequest(CamelModel):
    fcm_token: str
    device_type: str = Field("android", pattern="^(android|ios|web)$")
    device_model: Optional[str] = "Pixel 7 Pro"

class DeviceRead(CamelModel):
    device_id: uuid.UUID
    fcm_token: str
    device_type: str
    is_active: bool
    updated_at: datetime

class NotificationItem(CamelModel):
    id: uuid.UUID
    title: str
    body: str
    notification_type: str
    appointment_id: Optional[uuid.UUID] = None
    is_read: bool
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

class NotificationListResponse(CamelModel):
    items: List[NotificationItem]
    unread_count: int
    total: int
    page: int
    page_size: int

class NotificationReadResponse(CamelModel):
    id: uuid.UUID
    is_read: bool
    read_at: datetime

class MarkAllReadResponse(CamelModel):
    success: bool = True
    marked_count: int
