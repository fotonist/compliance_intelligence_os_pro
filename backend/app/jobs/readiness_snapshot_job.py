from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.tenants import Tenant
from app.services.readiness_snapshot_service import (
    get_snapshot_policy,
    get_all_processes,
    get_matrix_linked_processes,
    insert_snapshot,
)
from app.services.readiness_service import calculate_process_readiness


def run_readiness_snapshot():
    db: Session = SessionLocal()

    try:
        tenants = db.query(Tenant).all()

        for tenant in tenants:

            policy_mode = get_snapshot_policy(db, tenant.id)

            if policy_mode == "all":
                processes = get_all_processes(db, tenant.id)
            else:
                processes = get_matrix_linked_processes(db, tenant.id)

            for process in processes:

                readiness_data = calculate_process_readiness(
                    db=db,
                    tenant_id=tenant.id,
                    process_id=process.id,
                )

                insert_snapshot(
                    db=db,
                    tenant_id=tenant.id,
                    process_id=process.id,
                    readiness_score=readiness_data["readiness_score"],
                    exposure_score=readiness_data["exposure_score"],
                    risk_count=readiness_data["risk_count"],
                    approved_evidence_ratio=readiness_data["approved_evidence_ratio"],
                )

        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()