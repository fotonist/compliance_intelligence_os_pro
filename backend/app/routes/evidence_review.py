# ------------------------------------------------------
# EVIDENCE APPROVE
# ------------------------------------------------------

@router.post("/evidence/{evidence_id}/approve")
def approve_evidence(
    evidence_id: int,
    db: Session = Depends(get_db)
):

    db.execute(
        text(
            """
            UPDATE evidences
            SET
                status = 'approved',
                approval_status = 'approved',
                approved_at = now()
            WHERE id = :evidence_id
            """
        ),
        {"evidence_id": evidence_id}
    )

    db.commit()

    return {"success": True}

# ------------------------------------------------------
# EVIDENCE REJECT
# ------------------------------------------------------
@router.post("/evidence/{evidence_id}/reject")
def reject_evidence(
    evidence_id: int,
    payload: dict,
    db: Session = Depends(get_db)
):

    db.execute(
        text(
            """
            UPDATE evidences
            SET
                status = 'rejected',
                approval_status = 'rejected',
                review_comment = :comment
            WHERE id = :evidence_id
            """
        ),
        {
            "evidence_id": evidence_id,
            "comment": payload.get("comment")
        }
    )

    db.commit()

    return {"success": True}