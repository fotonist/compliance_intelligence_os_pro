from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


NotificationCategory = Literal[
    "SYSTEM",
    "COMPLIANCE",
    "RISK",
    "AUDIT",
    "TASK",
    "EVIDENCE",
    "INTEGRATION",
    "SECURITY",
]

NotificationSeverity = Literal[
    "INFO",
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
]

NotificationChannel = Literal[
    "IN_APP",
    "EMAIL",
    "SMS",
]

NotificationDeliveryStatus = Literal[
    "PENDING",
    "SENT",
    "DELIVERED",
    "FAILED",
    "SKIPPED",
]


class NotificationDeliveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    channel: str
    status: str
    provider: str | None = None
    provider_message_id: str | None = None
    attempt_count: int
    last_attempt_at: datetime | None = None
    delivered_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    severity: str
    title: str
    message: str
    entity_type: str | None = None
    entity_id: int | None = None
    action_url: str | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class NotificationDetailRead(NotificationRead):
    recipient_user_id: int
    recipient_email: str | None = None
    recipient_name: str | None = None
    deliveries: list[NotificationDeliveryRead] = Field(default_factory=list)


class NotificationPreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    channel: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class NotificationPreferenceUpdate(BaseModel):
    category: NotificationCategory
    channel: NotificationChannel
    enabled: bool


class NotificationListResponse(BaseModel):
    items: list[NotificationRead]
    total: int
    unread: int


class NotificationUnreadCountResponse(BaseModel):
    unread: int


class NotificationReadResponse(BaseModel):
    success: bool
    id: int


class NotificationBulkReadResponse(BaseModel):
    success: bool
    updated: int


class NotificationAdminRead(NotificationDetailRead):
    tenant_id: int


class NotificationAdminListResponse(BaseModel):
    items: list[NotificationAdminRead]
    total: int
    unread: int
    failed_deliveries: int

class NotificationAdminDetailRead(NotificationAdminRead):
    pass
