from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice

from app.services.framework.framework_import_service import (
    FrameworkImportService,
)
from app.services.framework.framework_validation_service import (
    FrameworkValidationService,
)


class FrameworkPublishService:
    """
    Framework import ve publish işlemlerini yöneten servis.

    Mevcut canonical framework version publish işlemi korunur.
    Yeni framework paketleri için publish_import() transactional
    olarak Standard -> Version -> Structure oluşturur.

    Herhangi bir hata veya post-publish validation başarısızlığı
    durumunda transaction rollback edilir.
    """

    CONTROL_BASED = "CONTROL_BASED"
    MATURITY_BASED = "MATURITY_BASED"

    def __init__(self, db: Session):
        self.db = db
        self.import_service = FrameworkImportService(db)
        self.validation_service = FrameworkValidationService(db)

    # ------------------------------------------------------------------
    # EXISTING VERSION PUBLISH
    # ------------------------------------------------------------------

    def publish(
        self,
        standard_id: int,
        version_id: int,
    ) -> Dict[str, Any]:
        version = (
            self.db.query(StandardVersion)
            .filter(
                StandardVersion.id == version_id,
                StandardVersion.standard_id == standard_id,
            )
            .first()
        )

        if version is None:
            raise ValueError("Standard version not found.")

        validation = self.validation_service.validate_version(version.id)

        if not validation["valid"]:
            return {
                "published": False,
                "version_id": version.id,
                "status": version.status,
                "validation": validation,
            }

        try:
            version.status = "published"
            self.db.commit()
            self.db.refresh(version)

        except Exception:
            self.db.rollback()
            raise

        return {
            "published": True,
            "version_id": version.id,
            "status": version.status,
            "validation": validation,
        }

    # ------------------------------------------------------------------
    # IMPORT + PUBLISH
    # ------------------------------------------------------------------

    def publish_import(
        self,
        payload: Dict[str, Any],
        commit: bool = True,
    ) -> Dict[str, Any]:
        """
        Yeni bir framework paketini normalize eder, validate eder,
        canonical framework tablolarına transactional olarak yazar
        ve publish eder.

        Bu metod mevcut DB'deki framework verilerini değiştirmez.
        Aynı standard/version zaten varsa duplicate import engellenir.
        """

        preview = self.import_service.preview(payload)

        if not preview["valid"]:
            return {
                "published": False,
                "phase": "PRE_PUBLISH_VALIDATION",
                "validation": preview,
            }

        normalized = preview["normalized"]

        standard_data = normalized["standard"]
        standard_code = standard_data["code"]
        standard_title = standard_data.get("title")
        standard_description = standard_data.get("description")
        standard_type = standard_data.get(
            "type",
            self.CONTROL_BASED,
        )

        versions = normalized.get("versions", [])

        if len(versions) != 1:
            return {
                "published": False,
                "phase": "VERSION_SELECTION",
                "error": (
                    "publish_import currently requires exactly "
                    "one version in the import payload."
                ),
            }

        version_data = versions[0]
        version_code = version_data["version_code"]

        # --------------------------------------------------------------
        # PRE-CHECK DUPLICATES
        # --------------------------------------------------------------

        existing_standard = (
            self.db.query(Standard)
            .filter(Standard.code == standard_code)
            .first()
        )

        if existing_standard is not None:
            existing_version = (
                self.db.query(StandardVersion)
                .filter(
                    StandardVersion.standard_id == existing_standard.id,
                    StandardVersion.version_code == version_code,
                )
                .first()
            )

            if existing_version is not None:
                return {
                    "published": False,
                    "phase": "DUPLICATE_CHECK",
                    "error": (
                        f"Standard {standard_code!r} version "
                        f"{version_code!r} already exists."
                    ),
                    "standard_id": existing_standard.id,
                    "version_id": existing_version.id,
                }

        # --------------------------------------------------------------
        # TRANSACTION
        # --------------------------------------------------------------

        try:
            # ----------------------------------------------------------
            # STANDARD
            # ----------------------------------------------------------

            standard = existing_standard

            if standard is None:
                standard = Standard(
                    code=standard_code,
                    title=standard_title,
                    description=standard_description,
                    type=standard_type,
                )
                self.db.add(standard)
                self.db.flush()

            # ----------------------------------------------------------
            # VERSION
            # ----------------------------------------------------------

            version = StandardVersion(
                standard_id=standard.id,
                version_code=version_code,
                status="published",
            )

            self.db.add(version)
            self.db.flush()

            # ----------------------------------------------------------
            # CONTROL-BASED
            # ----------------------------------------------------------

            if standard_type == self.CONTROL_BASED:
                self._create_control_based_structure(
                    standard=standard,
                    version=version,
                    payload=normalized,
                )

            # ----------------------------------------------------------
            # MATURITY-BASED
            # ----------------------------------------------------------

            elif standard_type == self.MATURITY_BASED:
                self._create_maturity_based_structure(
                    standard=standard,
                    version=version,
                    payload=normalized,
                )

            else:
                raise ValueError(
                    f"Unsupported framework type: {standard_type!r}"
                )

            # Ensure all generated ORM objects are persisted in the
            # current transaction before post-publish validation.
            self.db.flush()

            # ----------------------------------------------------------
            # POST-PUBLISH VALIDATION
            # ----------------------------------------------------------

            validation = self.validation_service.validate_version(
                version.id
            )

            if not validation["valid"]:
                self.db.rollback()

                return {
                    "published": False,
                    "phase": "POST_PUBLISH_VALIDATION",
                    "validation": validation,
                }

            # ----------------------------------------------------------
            # COMMIT
            # ----------------------------------------------------------

            if commit:
                self.db.commit()
                self.db.refresh(standard)
                self.db.refresh(version)

            return {
                "published": True,
                "phase": "COMMITTED" if commit else "READY_TO_COMMIT",
                "standard_id": standard.id,
                "version_id": version.id,
                "status": version.status,
                "standard": {
                    "code": standard.code,
                    "title": standard.title,
                    "type": standard.type,
                },
                "version": {
                    "version_code": version.version_code,
                    "status": version.status,
                },
                "validation": validation,
                "summary": {
                    "clauses": len(normalized.get("clauses", [])),
                    "requirements": len(
                        normalized.get("requirements", [])
                    ),
                    "controls": len(normalized.get("controls", [])),
                    "process_areas": len(
                        normalized.get("process_areas", [])
                    ),
                    "practices": len(
                        normalized.get("practices", [])
                    ),
                    "mappings": len(
                        normalized.get("mappings", [])
                    ),
                    "mappings_persisted": False,
                },
            }

        except Exception:
            self.db.rollback()
            raise

    # ------------------------------------------------------------------
    # CONTROL-BASED CREATION
    # ------------------------------------------------------------------

    def _create_control_based_structure(
        self,
        standard: Standard,
        version: StandardVersion,
        payload: Dict[str, Any],
    ) -> None:
        clause_map: Dict[str, Clause] = {}
        requirement_map: Dict[str, Requirement] = {}

        # --------------------------------------------------------------
        # CLAUSES
        # --------------------------------------------------------------

        for item in payload.get("clauses", []):
            code = item["code"]

            if code in clause_map:
                raise ValueError(
                    f"Duplicate Clause code in import payload: {code!r}"
                )

            clause = Clause(
                standard_id=standard.id,
                standard_version_id=version.id,
                code=code,
                title=item.get("title"),
                description=item.get("description"),
            )

            self.db.add(clause)
            self.db.flush()

            clause_map[code] = clause

        # --------------------------------------------------------------
        # REQUIREMENTS
        # --------------------------------------------------------------

        for item in payload.get("requirements", []):
            code = item["code"]
            clause_code = item.get("clause_code")

            if code in requirement_map:
                raise ValueError(
                    "Duplicate Requirement code in import payload: "
                    f"{code!r}"
                )

            if not clause_code:
                raise ValueError(
                    f"Requirement {code!r} has no clause_code."
                )

            clause = clause_map.get(clause_code)

            if clause is None:
                raise ValueError(
                    f"Requirement {code!r} references unknown "
                    f"Clause {clause_code!r}."
                )

            requirement = Requirement(
                clause_id=clause.id,
                code=code,
                title=item["title"],
                description=item.get("description"),
            )

            self.db.add(requirement)
            self.db.flush()

            requirement_map[code] = requirement

        # --------------------------------------------------------------
        # CONTROLS
        # --------------------------------------------------------------

        control_codes = set()

        for item in payload.get("controls", []):
            code = item["code"]

            if code in control_codes:
                raise ValueError(
                    f"Duplicate Control code in import payload: {code!r}"
                )

            requirement_code = item.get("requirement_code")
            requirement = None

            if requirement_code:
                requirement = requirement_map.get(requirement_code)

                if requirement is None:
                    raise ValueError(
                        f"Control {code!r} references unknown "
                        f"Requirement {requirement_code!r}."
                    )

            control = Control(
                standard_version_id=version.id,
                origin=item.get("origin", "canonical"),
                requirement_id=(
                    requirement.id
                    if requirement is not None
                    else None
                ),
                code=code,
                title=item.get("title"),
                description=item.get("description"),
            )

            self.db.add(control)
            control_codes.add(code)

        self.db.flush()

    # ------------------------------------------------------------------
    # MATURITY-BASED CREATION
    # ------------------------------------------------------------------

    def _create_maturity_based_structure(
        self,
        standard: Standard,
        version: StandardVersion,
        payload: Dict[str, Any],
    ) -> None:
        area_map: Dict[str, StandardProcessArea] = {}

        # --------------------------------------------------------------
        # PROCESS AREAS
        # --------------------------------------------------------------

        for item in payload.get("process_areas", []):
            code = item.get("code")

            if code in area_map:
                raise ValueError(
                    f"Duplicate ProcessArea code in import payload: "
                    f"{code!r}"
                )

            area = StandardProcessArea(
                standard_id=standard.id,
                standard_version_id=version.id,
                code=code,
                name=item["name"],
                description=item.get("description"),
                sort_order=item.get("sort_order", 0),
            )

            self.db.add(area)
            self.db.flush()

            if code:
                area_map[code] = area

        # --------------------------------------------------------------
        # PRACTICES
        # --------------------------------------------------------------

        practice_keys = set()

        for item in payload.get("practices", []):
            code = item.get("code")
            level = item.get("level")
            area_code = item.get("process_area_code")

            if not area_code:
                raise ValueError(
                    f"Practice {code!r} has no process_area_code."
                )

            area = area_map.get(area_code)

            if area is None:
                raise ValueError(
                    f"Practice {code!r} references unknown "
                    f"ProcessArea {area_code!r}."
                )

            key = (
                area.id,
                level,
                code,
            )

            if key in practice_keys:
                raise ValueError(
                    "Duplicate Practice key in import payload: "
                    f"(process_area={area_code!r}, "
                    f"level={level!r}, code={code!r})"
                )

            practice_keys.add(key)

            practice = StandardPractice(
                standard_id=standard.id,
                process_area_id=area.id,
                level=level,
                code=code,
                title=item.get("title"),
                text=item.get("text", ""),
                guidance=item.get("guidance"),
                is_active=item.get("is_active", True),
                sort_order=item.get("sort_order", 0),
            )

            self.db.add(practice)

        self.db.flush()
