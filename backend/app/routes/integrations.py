from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.permission_checker import require_permission
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationRead,
    IntegrationTestResponse,
    IntegrationUpdate,
)
from app.services.integration_service import (
    create_integration,
    delete_integration,
    get_integration,
    list_integrations,
    test_integration,
    update_integration,
)


router = APIRouter(
    prefix="/admin/integrations",
    tags=["Integrations"],
)


@router.get(
    "",
    response_model=list[IntegrationRead],
)
def get_integrations(
    db: Session = Depends(get_db),
    user=Depends(require_permission("integration.view")),
):
    return list_integrations(
        db=db,
        tenant_id=user.tenant_id,
    )


@router.get(
    "/{provider}",
    response_model=IntegrationRead,
)
def get_integration_detail(
    provider: str,
    db: Session = Depends(get_db),
    user=Depends(require_permission("integration.view")),
):
    integration = get_integration(
        db=db,
        tenant_id=user.tenant_id,
        provider=provider,
    )

    return integration


@router.post(
    "",
    response_model=IntegrationRead,
    status_code=201,
)
def create_integration_config(
    payload: IntegrationCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("integration.edit")),
):
    return create_integration(
        db=db,
        tenant_id=user.tenant_id,
        payload=payload,
    )


@router.patch(
    "/{provider}",
    response_model=IntegrationRead,
)
def update_integration_config(
    provider: str,
    payload: IntegrationUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("integration.edit")),
):
    return update_integration(
        db=db,
        tenant_id=user.tenant_id,
        provider=provider,
        payload=payload,
    )


@router.delete(
    "/{provider}",
    status_code=204,
)
def delete_integration_config(
    provider: str,
    db: Session = Depends(get_db),
    user=Depends(require_permission("integration.edit")),
):
    delete_integration(
        db=db,
        tenant_id=user.tenant_id,
        provider=provider,
    )


@router.post(
    "/{provider}/test",
    response_model=IntegrationTestResponse,
)
def test_integration_connection(
    provider: str,
    db: Session = Depends(get_db),
    user=Depends(require_permission("integration.test")),
):
    return test_integration(
        db=db,
        tenant_id=user.tenant_id,
        provider=provider,
    )
