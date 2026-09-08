from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.external_integrations import ExternalIntegration
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationRead,
    IntegrationTestResponse,
    IntegrationUpdate,
)


SUPPORTED_PROVIDERS = {"jira", "clickup"}


def _normalize_provider(provider: str) -> str:
    value = provider.strip().lower()

    if value not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported integration provider",
        )

    return value


def _clean_optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    value = value.strip()

    return value or None


def _validate_create_payload(payload: IntegrationCreate) -> None:
    if payload.provider == "jira":
        required = {
            "base_url": payload.base_url,
            "jira_email": payload.jira_email,
            "api_token": payload.api_token,
            "project_key": payload.project_key,
        }

        missing = [
            key
            for key, value in required.items()
            if not value or not str(value).strip()
        ]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing Jira fields: {', '.join(missing)}",
            )

    if payload.provider == "clickup":
        if not payload.api_token or not payload.api_token.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ClickUp api_token is required",
            )


def _serialize(integration: ExternalIntegration) -> IntegrationRead:
    return IntegrationRead(
        id=integration.id,
        provider=integration.provider,
        base_url=integration.base_url,
        jira_email=integration.jira_email,
        project_key=integration.project_key,
        issue_type=integration.issue_type,
        team_id=integration.team_id,
        space_id=integration.space_id,
        folder_id=integration.folder_id,
        list_id=integration.list_id,
        is_active=integration.is_active,
        has_api_token=bool(integration.api_token),
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )


def list_integrations(
    db: Session,
    tenant_id: int,
) -> list[IntegrationRead]:
    rows = (
        db.query(ExternalIntegration)
        .filter(ExternalIntegration.tenant_id == tenant_id)
        .order_by(ExternalIntegration.provider.asc())
        .all()
    )

    return [_serialize(row) for row in rows]


def get_integration(
    db: Session,
    tenant_id: int,
    provider: str,
) -> ExternalIntegration:
    provider = _normalize_provider(provider)

    integration = (
        db.query(ExternalIntegration)
        .filter(
            ExternalIntegration.tenant_id == tenant_id,
            ExternalIntegration.provider == provider,
        )
        .first()
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not configured",
        )

    return integration


def create_integration(
    db: Session,
    tenant_id: int,
    payload: IntegrationCreate,
) -> IntegrationRead:
    provider = _normalize_provider(payload.provider)

    _validate_create_payload(payload)

    existing = (
        db.query(ExternalIntegration)
        .filter(
            ExternalIntegration.tenant_id == tenant_id,
            ExternalIntegration.provider == provider,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integration already configured",
        )

    integration = ExternalIntegration(
        tenant_id=tenant_id,
        provider=provider,
        base_url=_clean_optional(payload.base_url),
        jira_email=_clean_optional(payload.jira_email),
        api_token=_clean_optional(payload.api_token),
        project_key=_clean_optional(payload.project_key),
        issue_type=_clean_optional(payload.issue_type) or "Task",
        team_id=_clean_optional(payload.team_id),
        space_id=_clean_optional(payload.space_id),
        folder_id=_clean_optional(payload.folder_id),
        list_id=_clean_optional(payload.list_id),
        is_active=True,
    )

    db.add(integration)
    db.commit()
    db.refresh(integration)

    return _serialize(integration)


def update_integration(
    db: Session,
    tenant_id: int,
    provider: str,
    payload: IntegrationUpdate,
) -> IntegrationRead:
    integration = get_integration(
        db=db,
        tenant_id=tenant_id,
        provider=provider,
    )

    data = payload.model_dump(exclude_unset=True)

    if "api_token" in data:
        token = data.pop("api_token")

        if token is not None and token.strip():
            integration.api_token = token.strip()

    for field in (
        "base_url",
        "jira_email",
        "project_key",
        "issue_type",
        "team_id",
        "space_id",
        "folder_id",
        "list_id",
        "is_active",
    ):
        if field not in data:
            continue

        value = data[field]

        if isinstance(value, str):
            value = value.strip() or None

        setattr(integration, field, value)

    db.commit()
    db.refresh(integration)

    return _serialize(integration)


def delete_integration(
    db: Session,
    tenant_id: int,
    provider: str,
) -> None:
    integration = get_integration(
        db=db,
        tenant_id=tenant_id,
        provider=provider,
    )

    db.delete(integration)
    db.commit()


def test_integration(
    db: Session,
    tenant_id: int,
    provider: str,
) -> IntegrationTestResponse:
    integration = get_integration(
        db=db,
        tenant_id=tenant_id,
        provider=provider,
    )

    if not integration.api_token:
        return IntegrationTestResponse(
            provider=integration.provider,
            success=False,
            message="Integration token is not configured",
        )

    try:
        if integration.provider == "jira":
            from app.services.jira_client import JiraClient

            return JiraClient.test_connection(integration)

        if integration.provider == "clickup":
            from app.services.clickup_client import ClickUpClient

            return ClickUpClient.test_connection(integration)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported integration provider",
        )

    except HTTPException:
        raise
    except Exception:
        return IntegrationTestResponse(
            provider=integration.provider,
            success=False,
            message="Connection test failed",
        )
