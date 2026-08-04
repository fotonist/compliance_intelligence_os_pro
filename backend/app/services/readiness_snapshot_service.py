from sqlalchemy.orm import Session
from datetime import datetime
from app.models.process import Process
from app.models.snapshot_policy import SnapshotPolicy
from app.models.process_readiness_history import ProcessReadinessHistory
from app.services.readiness_service import calculate_process_readiness


def get_snapshot_policy(db: Session, tenant_id: int) -> str:
    policy = (
        db.query(SnapshotPolicy)
        .filter(SnapshotPolicy.tenant_id == tenant_id)
        .first()
    )

    if not policy:
        return "matrix_linked"  # default safe mode

    return policy.mode


def get_all_processes(db: Session, tenant_id: int):
    return (
        db.query(Process)
        .filter(Process.tenant_id == tenant_id)
        .all()
    )


def get_matrix_linked_processes(db: Session, tenant_id: int):
    from app.models.matrix_instance import MatrixInstance

    return (
        db.query(Process)
        .join(MatrixInstance, MatrixInstance.process_id == Process.id)
        .filter(
            Process.tenant_id == tenant_id,
            MatrixInstance.status == "active",
        )
        .distinct()
        .all()
    )


def insert_snapshot(
    db,
    tenant_id: int,
    process_id: int,
    readiness_score: float,
    exposure_score: float,
    risk_count: int,
    approved_evidence_ratio: float,
):
    snapshot = ProcessReadinessHistory(
        tenant_id=tenant_id,
        process_id=process_id,
        readiness_score=readiness_score,
        exposure_score=exposure_score,
        risk_count=risk_count,
        approved_evidence_ratio=approved_evidence_ratio,
        calculated_at=datetime.utcnow(),  # gerçek timestamp
        snapshot_date=date.today(),       # günlük bucket (UNIQUE enforce burada)
    )

    db.add(snapshot)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()