from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.process import Process
from app.models.risks import Risk
from app.models.process_risk_link import ProcessRiskLink
from app.models.process_risk_link_audit import ProcessRiskLinkAudit
from app.services.risk_appetite_engine import RiskAppetiteEngine


class ProcessRiskLinkService:
    @staticmethod
    def _get_process(
        db: Session,
        tenant_id: int,
        process_id: int,
    ) -> Process:
        process = (
            db.query(Process)
            .filter(
                Process.id == process_id,
                Process.tenant_id == tenant_id,
            )
            .first()
        )

        if process is None:
            raise LookupError("Process not found")

        return process

    @staticmethod
    def _get_risk(
        db: Session,
        tenant_id: int,
        risk_id: int,
    ) -> Risk:
        risk = (
            db.query(Risk)
            .filter(
                Risk.id == risk_id,
                Risk.tenant_id == tenant_id,
            )
            .first()
        )

        if risk is None:
            raise LookupError("Risk not found")

        return risk

    @staticmethod
    def _get_link(
        db: Session,
        tenant_id: int,
        process_id: int,
        risk_id: int,
    ):
        return (
            db.query(ProcessRiskLink)
            .filter(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.process_id == process_id,
                ProcessRiskLink.risk_id == risk_id,
            )
            .first()
        )

    @staticmethod
    def _write_audit(
        db: Session,
        tenant_id: int,
        user_id: int,
        process_id: int,
        risk_id: int,
        action: str,
    ) -> None:
        db.add(
            ProcessRiskLinkAudit(
                tenant_id=tenant_id,
                process_id=process_id,
                risk_id=risk_id,
                user_id=user_id,
                action=action,
            )
        )

    @classmethod
    def refresh_risk_appetite(
        cls,
        db: Session,
        tenant_id: int,
        risk_id: int,
    ) -> dict:
        risk = cls._get_risk(
            db,
            tenant_id,
            risk_id,
        )

        rows = (
            db.query(ProcessRiskLink.process_id)
            .filter(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.risk_id == risk_id,
            )
            .all()
        )

        process_ids = sorted(
            {
                int(row[0])
                for row in rows
                if row[0] is not None
            }
        )

        if process_ids:
            thresholds = [
                (
                    process_id,
                    RiskAppetiteEngine.get_threshold(
                        db=db,
                        tenant_id=tenant_id,
                        process_id=process_id,
                    ),
                )
                for process_id in process_ids
            ]

            governing_process_id, threshold = min(
                thresholds,
                key=lambda item: (
                    int(item[1]),
                    int(item[0]),
                ),
            )
        else:
            governing_process_id = None
            threshold = RiskAppetiteEngine.get_threshold(
                db=db,
                tenant_id=tenant_id,
            )

        score = int(risk.score or 0)

        evaluation = RiskAppetiteEngine.evaluate(
            score=score,
            threshold=threshold,
        )

        risk.appetite_threshold = int(
            evaluation["threshold"]
        )
        risk.appetite_status = str(
            evaluation["status"]
        )
        risk.appetite_deviation = int(
            evaluation["deviation"]
        )

        db.flush()

        return {
            "risk_id": risk_id,
            "score": score,
            "process_ids": process_ids,
            "governing_process_id": governing_process_id,
            "threshold": int(evaluation["threshold"]),
            "status": str(evaluation["status"]),
            "deviation": int(evaluation["deviation"]),
        }

    @classmethod
    def link(
        cls,
        db: Session,
        tenant_id: int,
        user_id: int,
        process_id: int,
        risk_id: int,
    ):
        cls._get_process(db, tenant_id, process_id)
        cls._get_risk(db, tenant_id, risk_id)

        existing = cls._get_link(
            db,
            tenant_id,
            process_id,
            risk_id,
        )

        if existing is not None:
            return existing, False

        link = ProcessRiskLink(
            tenant_id=tenant_id,
            process_id=process_id,
            risk_id=risk_id,
        )

        db.add(link)
        db.flush()

        cls.refresh_risk_appetite(
            db=db,
            tenant_id=tenant_id,
            risk_id=risk_id,
        )

        cls._write_audit(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            process_id=process_id,
            risk_id=risk_id,
            action="LINKED",
        )

        db.commit()
        db.refresh(link)

        return link, True

    @classmethod
    def unlink(
        cls,
        db: Session,
        tenant_id: int,
        user_id: int,
        process_id: int,
        risk_id: int,
    ) -> bool:
        cls._get_process(db, tenant_id, process_id)
        cls._get_risk(db, tenant_id, risk_id)

        link = cls._get_link(
            db,
            tenant_id,
            process_id,
            risk_id,
        )

        if link is None:
            return False

        db.delete(link)
        db.flush()

        cls.refresh_risk_appetite(
            db=db,
            tenant_id=tenant_id,
            risk_id=risk_id,
        )

        cls._write_audit(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            process_id=process_id,
            risk_id=risk_id,
            action="UNLINKED",
        )

        db.commit()

        return True
