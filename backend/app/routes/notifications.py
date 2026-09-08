from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.models.user import User
from app.schemas.notification import (
    NotificationAdminDetailRead,
    NotificationAdminListResponse,
    NotificationBulkReadResponse,
    NotificationDetailRead,
    NotificationListResponse,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationReadResponse,
    NotificationUnreadCountResponse,
)
from app.services.notification_service import NotificationManager


router = APIRouter(tags=["Notifications"])


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
)
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category: str | None = Query(None),
    severity: str | None = Query(None),
    channel: str | None = Query(None),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.view")),
    scope=Depends(require_tenant_scope()),
):
    items, total, unread = NotificationManager.list_user_notifications(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
        skip=skip,
        limit=limit,
        category=category,
        severity=severity,
        channel=channel,
        unread_only=unread_only,
    )

    return {
        "items": items,
        "total": total,
        "unread": unread,
    }


@router.get(
    "/notifications/unread-count",
    response_model=NotificationUnreadCountResponse,
)
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.view")),
    scope=Depends(require_tenant_scope()),
):
    _, _, unread = NotificationManager.list_user_notifications(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
        skip=0,
        limit=1,
    )

    return {"unread": unread}


@router.get(
    "/notifications/preferences",
    response_model=list[NotificationPreferenceRead],
)
def get_notification_preferences(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.manage")),
    scope=Depends(require_tenant_scope()),
):
    return NotificationManager.get_preferences(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
    )


@router.put(
    "/notifications/preferences",
    response_model=NotificationPreferenceRead,
)
def update_notification_preference(
    payload: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.manage")),
    scope=Depends(require_tenant_scope()),
):
    return NotificationManager.update_preference(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
        category=payload.category,
        channel=payload.channel,
        enabled=payload.enabled,
    )


@router.post(
    "/notifications/read-all",
    response_model=NotificationBulkReadResponse,
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.view")),
    scope=Depends(require_tenant_scope()),
):
    updated = NotificationManager.mark_all_read(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
    )

    return {
        "success": True,
        "updated": updated,
    }


@router.get(
    "/notifications/{notification_id}",
    response_model=NotificationDetailRead,
)
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.view")),
    scope=Depends(require_tenant_scope()),
):
    notification = NotificationManager.get_user_notification(
        db=db,
        notification_id=notification_id,
        user_id=user.id,
        tenant_id=user.tenant_id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return notification


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationReadResponse,
)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.view")),
    scope=Depends(require_tenant_scope()),
):
    notification = NotificationManager.get_user_notification(
        db=db,
        notification_id=notification_id,
        user_id=user.id,
        tenant_id=user.tenant_id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    NotificationManager.mark_read(db, notification)

    return {
        "success": True,
        "id": notification.id,
    }


@router.get(
    "/admin/notifications",
    response_model=NotificationAdminListResponse,
)
def list_admin_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category: str | None = Query(None),
    severity: str | None = Query(None),
    delivery_status: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.manage")),
    scope=Depends(require_tenant_scope()),
):
    items, total, unread, failed = NotificationManager.list_admin_notifications(
        db=db,
        tenant_id=user.tenant_id,
        skip=skip,
        limit=limit,
        category=category,
        severity=severity,
        status=delivery_status,
    )

    result = []

    for item in items:
        recipient = item.recipient

        result.append(
            {
                "id": item.id,
                "tenant_id": item.tenant_id,
                "recipient_user_id": item.recipient_user_id,
                "recipient_email": getattr(recipient, "email", None),
                "recipient_name": getattr(recipient, "full_name", None),
                "category": item.category,
                "severity": item.severity,
                "title": item.title,
                "message": item.message,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "action_url": item.action_url,
                "is_read": item.is_read,
                "read_at": item.read_at,
                "created_at": item.created_at,
                "deliveries": item.deliveries,
            }
        )

    return {
        "items": result,
        "total": total,
        "unread": unread,
        "failed_deliveries": failed,
    }


@router.get(
    "/admin/notifications/{notification_id}",
    response_model=NotificationAdminDetailRead,
)
def get_admin_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("notification.manage")),
    scope=Depends(require_tenant_scope()),
):
    notification = NotificationManager.get_admin_notification(
        db=db,
        notification_id=notification_id,
        tenant_id=user.tenant_id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    recipient = notification.recipient

    return {
        "id": notification.id,
        "tenant_id": notification.tenant_id,
        "recipient_user_id": notification.recipient_user_id,
        "recipient_email": getattr(recipient, "email", None),
        "recipient_name": getattr(recipient, "full_name", None),
        "category": notification.category,
        "severity": notification.severity,
        "title": notification.title,
        "message": notification.message,
        "entity_type": notification.entity_type,
        "entity_id": notification.entity_id,
        "action_url": notification.action_url,
        "is_read": notification.is_read,
        "read_at": notification.read_at,
        "created_at": notification.created_at,
        "deliveries": notification.deliveries,
    }
