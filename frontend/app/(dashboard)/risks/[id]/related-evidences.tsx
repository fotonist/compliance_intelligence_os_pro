
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db


@router.get("/{risk_id}/related-evidences")
def get_related_evidences(
    risk_id: int,
    db: Session = Depends(get_db),
):
    # 1️⃣ Risk var mı? (control / clause için de lazım)
    current = db.execute(
        text(
            """
            SELECT id, control_id, clause_id
            FROM risks
            WHERE id = :id
            """
        ),
        {"id": risk_id},
    ).fetchone()

    if not current:
        raise HTTPException(status_code=404, detail="Risk not found")

    results = {}

    manual_rows = db.execute(
        text(
            """
            SELECT
                e.id,
                e.title,
                e.status,
                rel.relation_description
            FROM risk_evidence_links rel
            JOIN evidences e ON e.id = rel.evidence_id
            WHERE rel.risk_id = :risk_id
            """
        ),
        {"risk_id": risk_id},
    ).fetchall()

    for r in manual_rows:
        results[r.id] = {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "relation_reason": r.relation_description,
            "relation_source": "manual",
        }

     if current.control_id is not None:
        auto_control = db.execute(
            text(
                """
                SELECT id, title, status
                FROM evidences
                WHERE control_id = :control_id
                """
            ),
            {"control_id": current.control_id},
        ).fetchall()

        for r in auto_control:
            if r.id not in results:
                results[r.id] = {
                    "id": r.id,
                    "title": r.title,
                    "status": r.status,
                    "relation_reason": "Same control context",
                    "relation_source": "control_id",
                }

   
    if current.clause_id is not None:
        auto_clause = db.execute(
            text(
                """
                SELECT id, title, status
                FROM evidences
                WHERE clause_id = :clause_id
                """
            ),
            {"clause_id": current.clause_id},
        ).fetchall()

        for r in auto_clause:
            if r.id not in results:
                results[r.id] = {
                    "id": r.id,
                    "title": r.title,
                    "status": r.status,
                    "relation_reason": "Same clause context",
                    "relation_source": "clause_id",
                }

    return list(results.values())
