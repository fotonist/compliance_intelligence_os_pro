from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/control-health")
def get_control_health(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    summary_query = text("""
        SELECT
            COUNT(*) AS total_controls,
            COALESCE(AVG(
                CASE coverage_status
                    WHEN 'covered' THEN 100.0
                    WHEN 'partial' THEN 50.0
                    WHEN 'uncovered' THEN 0.0
                    ELSE 0.0
                END
            ), 0) AS avg_coverage,
            COALESCE(AVG(avg_risk_score), 0) AS avg_risk_score,
            SUM(CASE WHEN coverage_status <> 'covered' THEN 1 ELSE 0 END) AS weak_controls,
            (
                SELECT COUNT(*)
                FROM risks r
                WHERE r.tenant_id = :tenant_id
            ) AS risk_universe,
            (
                SELECT COUNT(*)
                FROM risks r
                WHERE r.tenant_id = :tenant_id
                  AND LOWER(COALESCE(r.status, '')) = 'open'
            ) AS open_risks
        FROM analytics.v_control_coverage_uee cc
        LEFT JOIN (
            SELECT
                r.control_id,
                AVG(r.score) AS avg_risk_score
            FROM risks r
            WHERE r.tenant_id = :tenant_id
              AND r.control_id IS NOT NULL
            GROUP BY r.control_id
        ) risk_stats ON risk_stats.control_id = cc.control_id
        INNER JOIN controls c ON c.id = cc.control_id
        WHERE c.tenant_id = :tenant_id
    """)

    summary_result = db.execute(summary_query, {"tenant_id": tenant_id}).mappings().first()

    controls_query = text("""
        SELECT
            cc.control_id,
            cc.code,
            cc.title,
            cc.evidence_count,
            cc.approved_files,
            cc.coverage_status,
            COUNT(DISTINCT r.id) AS linked_risk_count,
            MAX(r.score) AS worst_risk_score,
            AVG(r.score) AS avg_risk_score,
            CASE cc.coverage_status
                WHEN 'covered' THEN 100
                WHEN 'partial' THEN 50
                WHEN 'uncovered' THEN 0
                ELSE 0
            END AS coverage_score
        FROM analytics.v_control_coverage_uee cc
        INNER JOIN controls c ON c.id = cc.control_id
        LEFT JOIN risks r
          ON r.control_id = cc.control_id
         AND r.tenant_id = :tenant_id
        WHERE c.tenant_id = :tenant_id
        GROUP BY
            cc.control_id,
            cc.code,
            cc.title,
            cc.evidence_count,
            cc.approved_files,
            cc.coverage_status
        ORDER BY worst_risk_score DESC NULLS LAST, cc.code ASC
    """)

    controls_result = db.execute(controls_query, {"tenant_id": tenant_id}).mappings().all()

    return {
        "summary": dict(summary_result) if summary_result else {},
        "controls": [dict(row) for row in controls_result],
    }


@router.get("/control-health/{control_id}")
def get_control_detail(
    control_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    query = text("""
        SELECT
            cc.control_id,
            cc.code,
            cc.title,
            cc.evidence_count,
            cc.approved_files,
            cc.coverage_status,
            COUNT(DISTINCT r.id) AS linked_risk_count,
            MAX(r.score) AS worst_risk_score,
            AVG(r.score) AS avg_risk_score,
            CASE cc.coverage_status
                WHEN 'covered' THEN 100
                WHEN 'partial' THEN 50
                WHEN 'uncovered' THEN 0
                ELSE 0
            END AS coverage_score
        FROM analytics.v_control_coverage_uee cc
        INNER JOIN controls c ON c.id = cc.control_id
        LEFT JOIN risks r
          ON r.control_id = cc.control_id
         AND r.tenant_id = :tenant_id
        WHERE cc.control_id = :control_id
          AND c.tenant_id = :tenant_id
        GROUP BY
            cc.control_id,
            cc.code,
            cc.title,
            cc.evidence_count,
            cc.approved_files,
            cc.coverage_status
    """)

    result = db.execute(query, {"control_id": control_id, "tenant_id": tenant_id}).mappings().first()

    if not result:
        return {"detail": "Control not found"}

    return dict(result)
