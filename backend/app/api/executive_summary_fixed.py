from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.services.executive_summary_service_fixed import ExecutiveSummaryService

router = APIRouter(prefix="/executive-summary", tags=["Executive Summary"])


@router.get("")
def get_executive_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    return ExecutiveSummaryService(db=db, tenant_id=user.tenant_id).build()
