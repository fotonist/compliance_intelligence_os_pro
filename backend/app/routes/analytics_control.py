from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/control-health")
def get_control_health(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    # Summary
    summary_query = text("""
        SELECT
            COUNT(*) AS total_controls,
            AVG(coverage_score) AS avg_coverage,
            AVG(avg_risk_score) AS avg_risk_score,
            SUM(CASE WHEN coverage_score < 50 THEN 1 ELSE 0 END) AS weak_controls
        FROM analytics.v_control_health
        WHERE tenant_id = :tenant_id
    """)

    summary_result = db.execute(
        summary_query, {"tenant_id": tenant_id}
    ).mappings().first()

    # Controls list
    controls_query = text("""
        SELECT *
        FROM analytics.v_control_health
        WHERE tenant_id = :tenant_id
        ORDER BY worst_risk_score DESC NULLS LAST
    """)

    controls_result = db.execute(
        controls_query, {"tenant_id": tenant_id}
    ).mappings().all()

    return {
        "summary": dict(summary_result) if summary_result else {},
        "controls": [dict(row) for row in controls_result],
    }
# ------------------------------------------------------------------------------------------
# CONTROL HEALTH
# ------------------------------------------------------------------------------------------
@router.get("/control-health/{control_id}")
def get_control_detail(
    control_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    query = text("""
        SELECT *
        FROM analytics.v_control_health
        WHERE control_id = :control_id
          AND tenant_id = :tenant_id
    """)

    result = db.execute(
        query,
        {"control_id": control_id, "tenant_id": tenant_id}
    ).mappings().first()

    if not result:
        return {"detail": "Control not found"}

    return dict(result)