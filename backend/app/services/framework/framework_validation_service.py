from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice


class FrameworkValidationService:

    CONTROL_BASED = "CONTROL_BASED"
    MATURITY_BASED = "MATURITY_BASED"

    def __init__(self, db: Session):
        self.db = db

    def validate_standard(
        self,
        standard_id: int,
    ) -> Dict[str, Any]:
        errors: List[str] = []
        warnings: List[str] = []

        standard = (
            self.db.query(Standard)
            .filter(Standard.id == standard_id)
            .first()
        )

        if standard is None:
            errors.append(f"Standard {standard_id} not found.")
            return self._result(errors, warnings)

        if not standard.code:
            errors.append("Standard code is required.")

        versions = (
            self.db.query(StandardVersion)
            .filter(StandardVersion.standard_id == standard.id)
            .all()
        )

        if not versions:
            warnings.append(
                f"Standard {standard.code} has no StandardVersion."
            )

        for version in versions:
            self._validate_version(
                version,
                errors,
                warnings,
                standard_type=standard.type,
            )

        return self._result(errors, warnings)

    def validate_version(
        self,
        version_id: int,
    ) -> Dict[str, Any]:
        errors: List[str] = []
        warnings: List[str] = []

        version = (
            self.db.query(StandardVersion)
            .filter(StandardVersion.id == version_id)
            .first()
        )

        if version is None:
            errors.append(f"StandardVersion {version_id} not found.")
            return self._result(errors, warnings)

        standard = (
            self.db.query(Standard)
            .filter(Standard.id == version.standard_id)
            .first()
        )

        if standard is None:
            errors.append(
                f"Standard {version.standard_id} referenced by "
                f"StandardVersion {version.id} was not found."
            )
            return self._result(errors, warnings)

        if not standard.code:
            errors.append(
                f"Standard {standard.id} has no code."
            )

        self._validate_version(
            version,
            errors,
            warnings,
            standard_type=standard.type,
        )

        return self._result(errors, warnings)

    def _validate_version(
        self,
        version: StandardVersion,
        errors: List[str],
        warnings: List[str],
        standard_type: str | None = None,
    ) -> None:
        if not version.version_code:
            errors.append(
                f"StandardVersion {version.id} has no version_code."
            )

        if standard_type is None:
            standard = (
                self.db.query(Standard)
                .filter(Standard.id == version.standard_id)
                .first()
            )
            standard_type = (
                standard.type
                if standard is not None
                else self.CONTROL_BASED
            )

        if standard_type == self.CONTROL_BASED:
            self._validate_control_based_version(
                version,
                errors,
                warnings,
            )

        elif standard_type == self.MATURITY_BASED:
            self._validate_maturity_based_version(
                version,
                errors,
                warnings,
            )

        else:
            errors.append(
                f"StandardVersion {version.id} uses unsupported "
                f"standard type {standard_type!r}."
            )

    def _validate_control_based_version(
        self,
        version: StandardVersion,
        errors: List[str],
        warnings: List[str],
    ) -> None:
        clauses = (
            self.db.query(Clause)
            .filter(Clause.standard_version_id == version.id)
            .all()
        )

        requirements = (
            self.db.query(Requirement)
            .join(Clause, Requirement.clause_id == Clause.id)
            .filter(Clause.standard_version_id == version.id)
            .all()
        )

        controls = (
            self.db.query(Control)
            .filter(Control.standard_version_id == version.id)
            .all()
        )

        clause_codes = set()

        for clause in clauses:
            if not clause.code:
                errors.append(
                    f"Clause {clause.id} has no code."
                )
                continue

            if clause.code in clause_codes:
                errors.append(
                    f"Duplicate Clause code {clause.code!r} "
                    f"in StandardVersion {version.id}."
                )

            clause_codes.add(clause.code)

            if clause.standard_version_id != version.id:
                errors.append(
                    f"Clause {clause.id} references an invalid version."
                )

        requirement_codes = set()

        for requirement in requirements:
            if not requirement.code:
                errors.append(
                    f"Requirement {requirement.id} has no code."
                )
                continue

            if requirement.clause_id is None:
                errors.append(
                    f"Requirement {requirement.id} has no Clause."
                )

            clause = (
                self.db.query(Clause)
                .filter(Clause.id == requirement.clause_id)
                .first()
            )

            if clause is None:
                errors.append(
                    f"Requirement {requirement.id} references missing "
                    f"Clause {requirement.clause_id}."
                )
            elif clause.standard_version_id != version.id:
                errors.append(
                    f"Requirement {requirement.id} references a Clause "
                    f"from another StandardVersion."
                )

            if requirement.code in requirement_codes:
                errors.append(
                    f"Duplicate Requirement code {requirement.code!r} "
                    f"in StandardVersion {version.id}."
                )

            requirement_codes.add(requirement.code)

        control_codes = set()

        for control in controls:
            if not control.code:
                errors.append(
                    f"Control {control.id} has no code."
                )
                continue

            if control.code in control_codes:
                errors.append(
                    f"Duplicate Control code {control.code!r} "
                    f"in StandardVersion {version.id}."
                )

            control_codes.add(control.code)

            if control.standard_version_id != version.id:
                errors.append(
                    f"Control {control.id} references an invalid version."
                )

            if control.requirement_id is not None:
                requirement = (
                    self.db.query(Requirement)
                    .filter(Requirement.id == control.requirement_id)
                    .first()
                )

                if requirement is None:
                    errors.append(
                        f"Control {control.id} references missing "
                        f"Requirement {control.requirement_id}."
                    )
                else:
                    clause = (
                        self.db.query(Clause)
                        .filter(Clause.id == requirement.clause_id)
                        .first()
                    )

                    if (
                        clause is None
                        or clause.standard_version_id != version.id
                    ):
                        errors.append(
                            f"Control {control.id} references a "
                            "Requirement from another StandardVersion."
                        )

    def _validate_maturity_based_version(
        self,
        version: StandardVersion,
        errors: List[str],
        warnings: List[str],
    ) -> None:
        process_areas = (
            self.db.query(StandardProcessArea)
            .filter(
                StandardProcessArea.standard_version_id == version.id
            )
            .all()
        )

        practices = (
            self.db.query(StandardPractice)
            .join(
                StandardProcessArea,
                StandardPractice.process_area_id
                == StandardProcessArea.id,
            )
            .filter(
                StandardProcessArea.standard_version_id == version.id
            )
            .all()
        )

        area_codes = set()

        for area in process_areas:
            if not area.code:
                errors.append(
                    f"ProcessArea {area.id} has no code."
                )
            else:
                if area.code in area_codes:
                    errors.append(
                        f"Duplicate ProcessArea code {area.code!r} "
                        f"in StandardVersion {version.id}."
                    )

                area_codes.add(area.code)

            if area.standard_version_id != version.id:
                errors.append(
                    f"ProcessArea {area.id} references an invalid version."
                )

        practice_keys = set()

        for practice in practices:
            if not practice.code:
                errors.append(
                    f"Practice {practice.id} has no code."
                )
                continue

            # Maturity frameworks may intentionally reuse the same
            # practice code at different maturity levels. Therefore
            # uniqueness is evaluated in process-area + level context.
            key = (
                practice.process_area_id,
                practice.level,
                practice.code,
            )

            if key in practice_keys:
                errors.append(
                    f"Duplicate Practice key "
                    f"(process_area_id={practice.process_area_id}, "
                    f"level={practice.level}, "
                    f"code={practice.code!r}) "
                    f"in StandardVersion {version.id}."
                )

            practice_keys.add(key)

            process_area = (
                self.db.query(StandardProcessArea)
                .filter(
                    StandardProcessArea.id
                    == practice.process_area_id
                )
                .first()
            )

            if process_area is None:
                errors.append(
                    f"Practice {practice.id} references missing "
                    f"ProcessArea {practice.process_area_id}."
                )
            elif process_area.standard_version_id != version.id:
                errors.append(
                    f"Practice {practice.id} references a "
                    "ProcessArea from another StandardVersion."
                )

            if practice.level is None:
                errors.append(
                    f"Practice {practice.id} has no level."
                )

            if not practice.text:
                warnings.append(
                    f"Practice {practice.id} has no text."
                )

    @staticmethod
    def _result(
        errors: List[str],
        warnings: List[str],
    ) -> Dict[str, Any]:
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }
