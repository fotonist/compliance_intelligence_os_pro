from sqlalchemy.orm import Session
from sqlalchemy import delete
from app.models.gap_items import GapItem
from app.services.exposure_engine import ExposureEngine


class GapEngine:

    def __init__(self, db: Session):
        self.db = db

    def regenerate_gaps(self, tenant_id: int):

        # 1️⃣ Önce eski gapleri temizle (idempotent behavior)
        self.db.execute(
            delete(GapItem).where(GapItem.tenant_id == tenant_id)
        )

        engine = ExposureEngine(self.db)
        rows = engine.compute_risk_exposure(
            tenant_id=tenant_id,
            limit=100000
        )

        created = 0

        for r in rows:

            residual = float(r.residual_exposure or 0)
            escalation = float(r.escalation_probability_30d or 0)
            approved = int(r.approved_evidence_count or 0)

            # 🎯 GAP Logic
            if (
                residual >= 10
                and approved == 0
                and escalation >= 0.40
            ):

                severity = residual * escalation

                gap = GapItem(
                    tenant_id=tenant_id,
                    risk_id=r.risk_id,
                    control_id=r.control_id,
                    forecast_id=r.risk_version_id,
                    gap_type="risk_exposure_gap",
                    severity_score=severity,
                    status="uncovered"
                )

                self.db.add(gap)
                created += 1

        self.db.commit()

        return created