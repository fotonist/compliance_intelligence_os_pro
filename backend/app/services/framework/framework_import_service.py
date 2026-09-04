from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice


class FrameworkImportService:
    """
    Canonical framework import pipeline.

    Bu servis preview aşamasında DB'ye yazmaz.
    Import payload'ını normalize eder, yapısal ve referans
    kontrollerini yapar ve mevcut canonical kayıtlarla
    business-key bazında çakışmaları tespit eder.
    """

    REQUIRED_ROOT_FIELDS = {"standard", "versions"}

    CONTROL_BASED = "CONTROL_BASED"
    MATURITY_BASED = "MATURITY_BASED"

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # NORMALIZE
    # ------------------------------------------------------------------

    def normalize(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            raise ValueError("Framework payload must be an object.")

        missing = self.REQUIRED_ROOT_FIELDS - set(payload.keys())

        if missing:
            raise ValueError(
                "Framework payload missing required fields: "
                + ", ".join(sorted(missing))
            )

        standard = payload["standard"]
        versions = payload["versions"]

        if not isinstance(standard, dict):
            raise ValueError("Framework 'standard' must be an object.")

        if not isinstance(versions, list):
            raise ValueError("Framework 'versions' must be a list.")

        normalized_versions: List[Dict[str, Any]] = []

        for index, version in enumerate(versions):
            if not isinstance(version, dict):
                raise ValueError(
                    f"Framework version at index {index} must be an object."
                )

            version_copy = dict(version)

            for field in (
                "clauses",
                "requirements",
                "controls",
                "process_areas",
                "practices",
                "capability_levels",
                "mappings",
            ):
                version_copy.setdefault(field, [])

                if not isinstance(version_copy[field], list):
                    raise ValueError(
                        f"Framework version field '{field}' must be a list."
                    )

            normalized_versions.append(version_copy)

        return {
            "standard": dict(standard),
            "versions": normalized_versions,
        }

    # ------------------------------------------------------------------
    # SHAPE VALIDATION
    # ------------------------------------------------------------------

    def validate_shape(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        errors: List[str] = []
        warnings: List[str] = []

        try:
            normalized = self.normalize(payload)
        except ValueError as exc:
            return {
                "valid": False,
                "errors": [str(exc)],
                "warnings": [],
            }

        standard = normalized["standard"]

        code = standard.get("code")
        title = standard.get("title")
        framework_type = standard.get("type", self.CONTROL_BASED)

        if not code:
            errors.append("Standard code is required.")

        if not title:
            warnings.append("Standard title is missing.")

        if framework_type not in (
            self.CONTROL_BASED,
            self.MATURITY_BASED,
        ):
            errors.append(
                f"Unsupported standard type: {framework_type!r}. "
                f"Expected CONTROL_BASED or MATURITY_BASED."
            )

        if not normalized["versions"]:
            errors.append("Framework must contain at least one version.")

        for index, version in enumerate(normalized["versions"]):
            if not version.get("version_code"):
                errors.append(
                    f"Version at index {index} is missing version_code."
                )

            if framework_type == self.CONTROL_BASED:
                if version.get("process_areas"):
                    warnings.append(
                        f"Version at index {index} contains process_areas "
                        "but standard type is CONTROL_BASED."
                    )

                if version.get("practices"):
                    warnings.append(
                        f"Version at index {index} contains practices "
                        "but standard type is CONTROL_BASED."
                    )

            if framework_type == self.MATURITY_BASED:
                if version.get("clauses"):
                    warnings.append(
                        f"Version at index {index} contains clauses "
                        "but standard type is MATURITY_BASED."
                    )

                if version.get("requirements"):
                    warnings.append(
                        f"Version at index {index} contains requirements "
                        "but standard type is MATURITY_BASED."
                    )

                if version.get("controls"):
                    warnings.append(
                        f"Version at index {index} contains controls "
                        "but standard type is MATURITY_BASED."
                    )

        return {
            "valid": not errors,
            "errors": errors,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # REFERENCE VALIDATION
    # ------------------------------------------------------------------

    def validate_references(
        self,
        normalized: Dict[str, Any],
    ) -> Dict[str, Any]:
        errors: List[str] = []
        warnings: List[str] = []

        standard = normalized["standard"]
        framework_type = standard.get("type", self.CONTROL_BASED)

        for version_index, version in enumerate(normalized["versions"]):
            version_code = version.get("version_code")

            if framework_type == self.CONTROL_BASED:
                clauses = version.get("clauses", [])
                requirements = version.get("requirements", [])
                controls = version.get("controls", [])

                clause_codes = set()

                for index, clause in enumerate(clauses):
                    if not isinstance(clause, dict):
                        errors.append(
                            f"Version {version_code}: clause at index "
                            f"{index} must be an object."
                        )
                        continue

                    code = clause.get("code")

                    if not code:
                        errors.append(
                            f"Version {version_code}: clause at index "
                            f"{index} is missing code."
                        )
                    elif code in clause_codes:
                        errors.append(
                            f"Version {version_code}: duplicate clause code "
                            f"{code!r}."
                        )

                    clause_codes.add(code)

                requirement_codes = set()

                for index, requirement in enumerate(requirements):
                    if not isinstance(requirement, dict):
                        errors.append(
                            f"Version {version_code}: requirement at index "
                            f"{index} must be an object."
                        )
                        continue

                    code = requirement.get("code")
                    clause_code = requirement.get("clause_code")

                    if not code:
                        errors.append(
                            f"Version {version_code}: requirement at index "
                            f"{index} is missing code."
                        )
                    elif code in requirement_codes:
                        errors.append(
                            f"Version {version_code}: duplicate requirement "
                            f"code {code!r}."
                        )

                    requirement_codes.add(code)

                    if not clause_code:
                        errors.append(
                            f"Requirement {code!r} must specify clause_code."
                        )
                    elif clause_code not in clause_codes:
                        errors.append(
                            f"Requirement {code!r} references unknown "
                            f"clause_code {clause_code!r}."
                        )

                control_codes = set()

                for index, control in enumerate(controls):
                    if not isinstance(control, dict):
                        errors.append(
                            f"Version {version_code}: control at index "
                            f"{index} must be an object."
                        )
                        continue

                    code = control.get("code")
                    requirement_code = control.get("requirement_code")

                    if not code:
                        errors.append(
                            f"Version {version_code}: control at index "
                            f"{index} is missing code."
                        )
                    elif code in control_codes:
                        errors.append(
                            f"Version {version_code}: duplicate control "
                            f"code {code!r}."
                        )

                    control_codes.add(code)

                    if requirement_code and requirement_code not in requirement_codes:
                        errors.append(
                            f"Control {code!r} references unknown "
                            f"requirement_code {requirement_code!r}."
                        )

            elif framework_type == self.MATURITY_BASED:
                process_areas = version.get("process_areas", [])
                practices = version.get("practices", [])

                process_area_codes = set()

                for index, area in enumerate(process_areas):
                    if not isinstance(area, dict):
                        errors.append(
                            f"Version {version_code}: process_area at index "
                            f"{index} must be an object."
                        )
                        continue

                    code = area.get("code")

                    if not code:
                        errors.append(
                            f"Version {version_code}: process_area at index "
                            f"{index} is missing code."
                        )
                    elif code in process_area_codes:
                        errors.append(
                            f"Version {version_code}: duplicate process_area "
                            f"code {code!r}."
                        )

                    process_area_codes.add(code)

                practice_codes = set()

                for index, practice in enumerate(practices):
                    if not isinstance(practice, dict):
                        errors.append(
                            f"Version {version_code}: practice at index "
                            f"{index} must be an object."
                        )
                        continue

                    code = practice.get("code")
                    process_area_code = practice.get("process_area_code")

                    if not code:
                        errors.append(
                            f"Version {version_code}: practice at index "
                            f"{index} is missing code."
                        )
                    elif code in practice_codes:
                        errors.append(
                            f"Version {version_code}: duplicate practice "
                            f"code {code!r}."
                        )

                    practice_codes.add(code)

                    if not process_area_code:
                        errors.append(
                            f"Practice {code!r} must specify "
                            "process_area_code."
                        )
                    elif process_area_code not in process_area_codes:
                        errors.append(
                            f"Practice {code!r} references unknown "
                            f"process_area_code {process_area_code!r}."
                        )

        return {
            "valid": not errors,
            "errors": errors,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # DUPLICATE DETECTION
    # ------------------------------------------------------------------

    def detect_duplicates(
        self,
        normalized: Dict[str, Any],
    ) -> Dict[str, Any]:
        standard = normalized["standard"]
        standard_code = standard.get("code")

        existing_standard = (
            self.db.query(Standard)
            .filter(Standard.code == standard_code)
            .first()
        )

        result: Dict[str, Any] = {
            "standard_exists": existing_standard is not None,
            "standard_id": existing_standard.id
            if existing_standard
            else None,
            "versions": [],
        }

        for version in normalized["versions"]:
            version_code = version.get("version_code")

            existing_version = None

            if existing_standard:
                existing_version = (
                    self.db.query(StandardVersion)
                    .filter(
                        StandardVersion.standard_id == existing_standard.id,
                        StandardVersion.version_code == version_code,
                    )
                    .first()
                )

            result["versions"].append(
                {
                    "version_code": version_code,
                    "exists": existing_version is not None,
                    "version_id": existing_version.id
                    if existing_version
                    else None,
                    "status": existing_version.status
                    if existing_version
                    else None,
                }
            )

        return result

    # ------------------------------------------------------------------
    # PREVIEW
    # ------------------------------------------------------------------

    def preview(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        normalized = self.normalize(payload)

        shape = self.validate_shape(normalized)

        if not shape["valid"]:
            return {
                "valid": False,
                "normalized": normalized,
                "validation": {
                    "shape": shape,
                    "references": {
                        "valid": False,
                        "errors": [],
                        "warnings": [],
                    },
                },
                "duplicates": None,
                "summary": None,
            }

        references = self.validate_references(normalized)

        duplicates = self.detect_duplicates(normalized)

        standard = normalized["standard"]
        framework_type = standard.get("type", self.CONTROL_BASED)

        summary = {
            "standard_code": standard.get("code"),
            "standard_title": standard.get("title"),
            "type": framework_type,
            "version_count": len(normalized["versions"]),
            "clause_count": sum(
                len(v.get("clauses", []))
                for v in normalized["versions"]
            ),
            "requirement_count": sum(
                len(v.get("requirements", []))
                for v in normalized["versions"]
            ),
            "control_count": sum(
                len(v.get("controls", []))
                for v in normalized["versions"]
            ),
            "process_area_count": sum(
                len(v.get("process_areas", []))
                for v in normalized["versions"]
            ),
            "practice_count": sum(
                len(v.get("practices", []))
                for v in normalized["versions"]
            ),
            "mapping_count": sum(
                len(v.get("mappings", []))
                for v in normalized["versions"]
            ),
        }

        return {
            "valid": shape["valid"] and references["valid"],
            "normalized": normalized,
            "validation": {
                "shape": shape,
                "references": references,
            },
            "duplicates": duplicates,
            "summary": summary,
        }
