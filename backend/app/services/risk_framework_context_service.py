from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class RiskFrameworkContext:
    risk_id: int
    tenant_id: int

    resolved: bool
    consistency_status: str
    reason: Optional[str]

    standard_id: Optional[int]
    standard_code: Optional[str]
    standard_title: Optional[str]

    standard_version_id: Optional[int]
    version_code: Optional[str]

    adoption_id: Optional[int]
    framework_type: Optional[str]

    target_type: Optional[str]

    control_id: Optional[int] = None
    requirement_id: Optional[int] = None

    risk_version_id: Optional[int] = None
    base_practice_id: Optional[int] = None
    base_practice_code: Optional[str] = None
    base_practice_title: Optional[str] = None

    reference_process_id: Optional[int] = None
    reference_process_code: Optional[str] = None
    reference_process_name: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class RiskFrameworkContextService:
    CONTROL_BASED = "CONTROL_BASED"
    MATURITY_BASED = "MATURITY_BASED"

    @classmethod
    def resolve(
        cls,
        db: Session,
        *,
        tenant_id: int,
        risk_id: int,
    ) -> RiskFrameworkContext:
        risk = db.execute(
            text("""
                SELECT
                    r.id,
                    r.tenant_id,
                    r.standard_id,
                    r.control_id,
                    r.requirement_id,
                    s.code AS standard_code,
                    s.title AS standard_title,
                    s.type AS framework_type
                FROM risks r
                LEFT JOIN standards s
                  ON s.id = r.standard_id
                WHERE r.tenant_id = :tenant_id
                  AND r.id = :risk_id
            """),
            {
                "tenant_id": tenant_id,
                "risk_id": risk_id,
            },
        ).mappings().first()

        if risk is None:
            raise ValueError(
                f"Risk {risk_id} does not exist in tenant {tenant_id}."
            )

        standard_id = risk["standard_id"]
        framework_type = risk["framework_type"]

        if standard_id is None:
            return cls._unresolved(
                risk=risk,
                reason="RISK_STANDARD_NOT_ASSIGNED",
            )

        if framework_type not in (
            cls.CONTROL_BASED,
            cls.MATURITY_BASED,
        ):
            return cls._unresolved(
                risk=risk,
                reason="UNSUPPORTED_FRAMEWORK_TYPE",
            )

        adoptions = db.execute(
            text("""
                SELECT
                    fa.id AS adoption_id,
                    fa.standard_version_id,
                    sv.version_code
                FROM framework_adoptions fa
                JOIN standard_versions sv
                  ON sv.id = fa.standard_version_id
                 AND sv.standard_id = fa.standard_id
                WHERE fa.tenant_id = :tenant_id
                  AND fa.standard_id = :standard_id
                  AND fa.status = 'ACTIVE'
                  AND fa.applicability = 'APPLICABLE'
                ORDER BY fa.id DESC
            """),
            {
                "tenant_id": tenant_id,
                "standard_id": standard_id,
            },
        ).mappings().all()

        if not adoptions:
            return cls._unresolved(
                risk=risk,
                reason="ACTIVE_ADOPTION_NOT_FOUND",
            )

        if len(adoptions) != 1:
            return cls._unresolved(
                risk=risk,
                reason="AMBIGUOUS_ACTIVE_ADOPTION",
            )

        adoption = adoptions[0]

        if framework_type == cls.CONTROL_BASED:
            return cls._resolve_control_based(
                db=db,
                risk=risk,
                adoption=adoption,
            )

        return cls._resolve_maturity_based(
            db=db,
            risk=risk,
            adoption=adoption,
        )

    @classmethod
    def _resolve_control_based(
        cls,
        *,
        db: Session,
        risk,
        adoption,
    ) -> RiskFrameworkContext:
        control_id = risk["control_id"]

        if control_id is None:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                reason="CONTROL_TARGET_NOT_ASSIGNED",
            )

        control_exists = db.execute(
            text("""
                SELECT 1
                FROM matrix_instances mi
                JOIN matrix_rows mr
                  ON mr.instance_id = mi.id
                 AND mr.tenant_id = mi.tenant_id
                WHERE mi.id = (
                    SELECT active_matrix_instance_id
                    FROM framework_adoptions
                    WHERE id = :adoption_id
                )
                  AND mi.tenant_id = :tenant_id
                  AND mi.standard_id = :standard_id
                  AND mi.standard_version_id = :standard_version_id
                  AND mr.control_id = :control_id
                LIMIT 1
            """),
            {
                "adoption_id": adoption["adoption_id"],
                "tenant_id": risk["tenant_id"],
                "standard_id": risk["standard_id"],
                "standard_version_id": adoption["standard_version_id"],
                "control_id": control_id,
            },
        ).scalar_one_or_none()

        if control_exists is None:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                reason="CONTROL_NOT_IN_ACTIVE_ADOPTION",
            )

        return RiskFrameworkContext(
            risk_id=int(risk["id"]),
            tenant_id=int(risk["tenant_id"]),
            resolved=True,
            consistency_status="CONSISTENT",
            reason=None,
            standard_id=int(risk["standard_id"]),
            standard_code=risk["standard_code"],
            standard_title=risk["standard_title"],
            standard_version_id=int(adoption["standard_version_id"]),
            version_code=adoption["version_code"],
            adoption_id=int(adoption["adoption_id"]),
            framework_type=cls.CONTROL_BASED,
            target_type="CONTROL",
            control_id=int(control_id),
            requirement_id=(
                int(risk["requirement_id"])
                if risk["requirement_id"] is not None
                else None
            ),
        )

    @classmethod
    def _resolve_maturity_based(
        cls,
        *,
        db: Session,
        risk,
        adoption,
    ) -> RiskFrameworkContext:
        if risk["control_id"] is not None:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                reason="MATURITY_RISK_HAS_CONTROL_TARGET",
            )

        latest_version = db.execute(
            text("""
                SELECT id, version_number
                FROM risk_versions
                WHERE tenant_id = :tenant_id
                  AND risk_id = :risk_id
                ORDER BY version_number DESC, id DESC
                LIMIT 1
            """),
            {
                "tenant_id": risk["tenant_id"],
                "risk_id": risk["id"],
            },
        ).mappings().first()

        if latest_version is None:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                reason="RISK_VERSION_NOT_FOUND",
            )

        targets = db.execute(
            text("""
                SELECT
                    l.base_practice_id,
                    bp.code AS base_practice_code,
                    bp.title AS base_practice_title,
                    bp.standard_version_id,
                    bp.process_id AS reference_process_id,
                    rp.code AS reference_process_code,
                    rp.name AS reference_process_name
                FROM pam_base_practice_risk_links l
                JOIN standard_base_practices bp
                  ON bp.id = l.base_practice_id
                JOIN standard_reference_processes rp
                  ON rp.id = bp.process_id
                 AND rp.standard_version_id = bp.standard_version_id
                WHERE l.tenant_id = :tenant_id
                  AND l.risk_version_id = :risk_version_id
                ORDER BY l.base_practice_id
            """),
            {
                "tenant_id": risk["tenant_id"],
                "risk_version_id": latest_version["id"],
            },
        ).mappings().all()

        if not targets:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                risk_version_id=int(latest_version["id"]),
                reason="MATURITY_TARGET_NOT_ASSIGNED",
            )

        adoption_version_id = int(
            adoption["standard_version_id"]
        )

        invalid_versions = [
            row
            for row in targets
            if int(row["standard_version_id"])
            != adoption_version_id
        ]

        if invalid_versions:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                risk_version_id=int(latest_version["id"]),
                reason="MATURITY_TARGET_VERSION_MISMATCH",
            )

        process_ids = {
            int(row["reference_process_id"])
            for row in targets
        }

        if len(process_ids) != 1:
            return cls._unresolved(
                risk=risk,
                adoption=adoption,
                risk_version_id=int(latest_version["id"]),
                reason="AMBIGUOUS_MATURITY_PROCESS_TARGET",
            )

        # A risk version may be linked to multiple base practices,
        # but they must resolve to one reference process for the
        # current framework context.
        primary = targets[0]

        return RiskFrameworkContext(
            risk_id=int(risk["id"]),
            tenant_id=int(risk["tenant_id"]),
            resolved=True,
            consistency_status="CONSISTENT",
            reason=None,
            standard_id=int(risk["standard_id"]),
            standard_code=risk["standard_code"],
            standard_title=risk["standard_title"],
            standard_version_id=adoption_version_id,
            version_code=adoption["version_code"],
            adoption_id=int(adoption["adoption_id"]),
            framework_type=cls.MATURITY_BASED,
            target_type="BASE_PRACTICE",
            control_id=None,
            requirement_id=None,
            risk_version_id=int(latest_version["id"]),
            base_practice_id=int(primary["base_practice_id"]),
            base_practice_code=primary["base_practice_code"],
            base_practice_title=primary["base_practice_title"],
            reference_process_id=int(
                primary["reference_process_id"]
            ),
            reference_process_code=primary[
                "reference_process_code"
            ],
            reference_process_name=primary[
                "reference_process_name"
            ],
        )

    @classmethod
    def _unresolved(
        cls,
        *,
        risk,
        reason: str,
        adoption=None,
        risk_version_id: Optional[int] = None,
    ) -> RiskFrameworkContext:
        return RiskFrameworkContext(
            risk_id=int(risk["id"]),
            tenant_id=int(risk["tenant_id"]),
            resolved=False,
            consistency_status="UNRESOLVED",
            reason=reason,
            standard_id=(
                int(risk["standard_id"])
                if risk["standard_id"] is not None
                else None
            ),
            standard_code=risk["standard_code"],
            standard_title=risk["standard_title"],
            standard_version_id=(
                int(adoption["standard_version_id"])
                if adoption is not None
                else None
            ),
            version_code=(
                adoption["version_code"]
                if adoption is not None
                else None
            ),
            adoption_id=(
                int(adoption["adoption_id"])
                if adoption is not None
                else None
            ),
            framework_type=risk["framework_type"],
            target_type=None,
            control_id=(
                int(risk["control_id"])
                if risk["control_id"] is not None
                else None
            ),
            requirement_id=(
                int(risk["requirement_id"])
                if risk["requirement_id"] is not None
                else None
            ),
            risk_version_id=risk_version_id,
        )
