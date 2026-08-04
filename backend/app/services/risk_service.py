from sqlalchemy.orm import Session

from app.models.risks import Risk

# Evidence status mapping (case-tolerant)
COVERED_STATUSES = {
    "APPROVED", "Approved",
    "VALID", "Valid",
    "UPLOADED", "Uploaded",
}
UNCOVERED_STATUSES = {
    "PENDING", "Pending",
    "REJECTED", "Rejected",
    "EXPIRED", "Expired",
    "IN REVIEW", "In Review", "IN_REVIEW", "In_Review",
}


def recalculate_risk_coverage(db: Session, risk_id: int) -> None:
    """
    Evidence değiştiğinde çağrılır.
    Risk.control_coverage_status alanını deterministik olarak günceller.

    Rules:
      - NO_CONTROL: risk.control_id is None
      - NOT_COVERED: no evidences or 0 covered
      - PARTIALLY_COVERED: some covered and some uncovered
      - COVERED: all covered
    """
    risk = db.query(Risk).get(risk_id)
    if not risk:
        return

    # Control yoksa → NO_CONTROL
    if not risk.control_id:
        risk.control_coverage_status = "NO_CONTROL"
        db.add(risk)
        return

    evidences = list(getattr(risk, "evidences", []) or [])

    if not evidences:
        risk.control_coverage_status = "NOT_COVERED"
        db.add(risk)
        return

    covered_count = 0
    uncovered_count = 0

    for e in evidences:
        st = getattr(e, "status", None)

        if st in COVERED_STATUSES:
            covered_count += 1
        else:
            # Unknown statuses are treated as uncovered (safe default)
            uncovered_count += 1

    if covered_count > 0 and uncovered_count > 0:
        risk.control_coverage_status = "PARTIALLY_COVERED"
    elif covered_count > 0 and uncovered_count == 0:
        risk.control_coverage_status = "COVERED"
    else:
        risk.control_coverage_status = "NOT_COVERED"

    db.add(risk)
