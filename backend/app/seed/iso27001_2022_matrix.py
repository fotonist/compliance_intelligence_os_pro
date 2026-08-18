from __future__ import annotations

from typing import Dict

from sqlalchemy.orm import Session

from app.models.clauses import Clause
from app.models.controls import Control
from app.models.matrix_instance import MatrixInstance
from app.models.matrix_row import MatrixRow
from app.models.requirements import Requirement
from app.models.standard_versions import StandardVersion
from app.models.standards import Standard
from app.models.tenants import Tenant


STANDARD_CODE = "ISO27001:2022"
VERSION_CODE = "2022"

# Operational application anchors only.
# These mappings are NOT claims of ISO normative equivalence; they provide the
# application's Clause -> Requirement context while Annex A controls remain
# separate Control objects.
CONTROL_FAMILY_ANCHORS: Dict[str, tuple[str, str]] = {
    "A.5": ("5.3", "Organizational roles, responsibilities and authorities"),
    "A.6": ("7.2", "Competence"),
    "A.7": ("8.1", "Operational planning and control"),
    "A.8": ("8.1", "Operational planning and control"),
}



def _family(control_code: str) -> str:
    # Control description contains the ISO Annex A identifier, e.g. A.5.1.
    # Prefer the identifier from the description so the internal CTRL code
    # remains an application identifier.
    marker = "Annex A "
    if marker in control_code:
        return control_code.split(marker, 1)[1].split(".", 2)[0]
    raise ValueError(f"Cannot determine Annex A family from {control_code!r}")


def seed_iso27001_2022_matrix(db: Session) -> Dict[str, int]:
    """Build one current control-based Matrix Instance per active tenant.

    The 93 Annex A controls are represented as MatrixRows. Each row receives
    the application's operational Clause/Requirement anchor while keeping the
    actual Annex A identifier exclusively in the Control field.
    """
    try:
        standard = (
            db.query(Standard)
            .filter(Standard.code == STANDARD_CODE)
            .one_or_none()
        )
        if standard is None:
            raise RuntimeError(
                f"Standard {STANDARD_CODE!r} not found. Run the ISO 27001 seed first."
            )

        version = (
            db.query(StandardVersion)
            .filter(
                StandardVersion.standard_id == standard.id,
                StandardVersion.version_code == VERSION_CODE,
                StandardVersion.status == "active",
            )
            .one_or_none()
        )
        if version is None:
            raise RuntimeError(
                "Active ISO/IEC 27001:2022 StandardVersion not found. "
                "Run the ISO 27001 seed first."
            )

        clauses = {
            clause.code: clause
            for clause in db.query(Clause)
            .filter(Clause.standard_version_id == version.id)
            .all()
        }

        requirements = {
            requirement.code: requirement
            for requirement in db.query(Requirement)
            .join(Clause, Requirement.clause_id == Clause.id)
            .filter(Clause.standard_version_id == version.id)
            .all()
        }

        controls = (
            db.query(Control)
            .filter(Control.standard_version_id == version.id)
            .order_by(Control.code)
            .all()
        )

        if len(controls) != 93:
            raise RuntimeError(
                f"Expected 93 ISO 27001 Annex A controls, found {len(controls)}."
            )

        tenants = (
            db.query(Tenant)
            .filter(Tenant.status == "active")
            .order_by(Tenant.id)
            .all()
        )
        if not tenants:
            raise RuntimeError("No active tenant found.")

        total_instances = 0
        total_rows = 0

        for tenant in tenants:
            # Rebuild only the current ISO 27001 matrix for this tenant.
            db.query(MatrixRow).filter(
                MatrixRow.tenant_id == tenant.id,
                MatrixRow.standard_id == standard.id,
            ).delete(synchronize_session=False)

            db.query(MatrixInstance).filter(
                MatrixInstance.tenant_id == tenant.id,
                MatrixInstance.standard_id == standard.id,
            ).delete(synchronize_session=False)

            instance = MatrixInstance(
                tenant_id=tenant.id,
                standard_id=standard.id,
                standard_version_id=version.id,
                status="generated",
            )
            db.add(instance)
            db.flush()
            total_instances += 1

            for control in controls:
                description = control.description or ""
                marker = "Annex A "
                if marker not in description:
                    raise RuntimeError(
                        f"Control {control.code} does not contain an Annex A reference."
                    )

                annex_code = description.split(marker, 1)[1].strip()
                family = ".".join(annex_code.split(".")[:2])
                anchor = CONTROL_FAMILY_ANCHORS.get(family)
                if anchor is None:
                    raise RuntimeError(
                        f"No operational anchor defined for Annex A family {family}."
                    )

                requirement_code = anchor[0]
                requirement = requirements.get(requirement_code)
                if requirement is None:
                    raise RuntimeError(
                        f"Requirement {requirement_code!r} not found for control {control.code}."
                    )

                clause = clauses.get(requirement.code.split(".", 1)[0])
                if clause is None:
                    raise RuntimeError(
                        f"Clause not found for requirement {requirement.code}."
                    )

                row = MatrixRow(
                    tenant_id=tenant.id,
                    instance_id=instance.id,
                    standard_id=standard.id,
                    clause_id=clause.id,
                    requirement_id=requirement.id,
                    control_id=control.id,
                    mode="control",
                    row_key=f"{STANDARD_CODE}:{annex_code}",
                    payload={
                        "standard": STANDARD_CODE,
                        "version": VERSION_CODE,
                        "clause": clause.code,
                        "requirement": requirement.code,
                        "control": annex_code,
                        "control_id": control.id,
                        "mapping_type": "operational_anchor",
                        "mapping_note": (
                            "Application context mapping; not a normative ISO "
                            "Clause-to-Annex-A equivalence."
                        ),
                    },
                )
                db.add(row)
                total_rows += 1

        db.commit()

        return {
            "standard_id": standard.id,
            "standard_version_id": version.id,
            "tenants": len(tenants),
            "instances": total_instances,
            "controls": len(controls),
            "matrix_rows": total_rows,
        }

    except Exception:
        db.rollback()
        raise
