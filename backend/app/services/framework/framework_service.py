from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice

from app.services.framework.framework_resolution_service import (
    FrameworkResolutionService,
)
from app.services.framework.framework_validation_service import (
    FrameworkValidationService,
)
from app.services.framework.framework_version_service import (
    FrameworkVersionService,
)
from app.services.framework.framework_import_service import (
    FrameworkImportService,
)
from app.services.framework.framework_publish_service import (
    FrameworkPublishService,
)
from app.services.framework.framework_mapping_service import (
    FrameworkMappingService,
)


class FrameworkService:
    """
    Compliance Framework Engine ana facade servisi.

    Canonical framework modellerini ve tenant-specific matrix
    projection'ını tek bir servis yüzeyinde birleştirir.

    Framework structure, standard.type değerine göre çözülür:
      - CONTROL_BASED
      - MATURITY_BASED
    """

    def __init__(self, db: Session):
        self.db = db
        self.resolution = FrameworkResolutionService(db)
        self.validation = FrameworkValidationService(db)
        self.version = FrameworkVersionService(db)
        self.import_service = FrameworkImportService(db)
        self.publish = FrameworkPublishService(db)
        self.mapping = FrameworkMappingService(db)

    # ------------------------------------------------------------------
    # FRAMEWORK LIBRARY
    # ------------------------------------------------------------------

    def list_standards(self) -> List[Standard]:
        return (
            self.db.query(Standard)
            .order_by(Standard.code.asc(), Standard.id.asc())
            .all()
        )

    def get_standard(self, standard_id: int) -> Optional[Standard]:
        return self.resolution.resolve_standard(standard_id)

    # ------------------------------------------------------------------
    # VERSION MANAGEMENT
    # ------------------------------------------------------------------

    def list_versions(self, standard_id: int) -> List[StandardVersion]:
        return self.version.list_versions(standard_id)

    def get_version(
        self,
        standard_id: int,
        version_code: str,
    ) -> Optional[StandardVersion]:
        return self.version.get_version(
            standard_id=standard_id,
            version_code=version_code,
        )

    # ------------------------------------------------------------------
    # STRUCTURE
    # ------------------------------------------------------------------

    def get_structure(
        self,
        standard_id: int,
        version_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        standard = self.resolution.resolve_standard(standard_id)

        if standard is None:
            raise ValueError("Standard not found.")

        structure_type = (standard.type or "CONTROL_BASED").upper()

        if version_code:
            version = self.version.get_version(
                standard_id=standard_id,
                version_code=version_code,
            )

            if version is None:
                raise ValueError("Standard version not found.")

            if structure_type == "MATURITY_BASED":
                return self._build_maturity_structure(
                    standard=standard,
                    version=version,
                )

            return self._build_control_structure(
                standard=standard,
                version=version,
            )

        versions = self.version.list_versions(standard_id)

        return {
            "standard": standard,
            "structure_type": structure_type,
            "versions": versions,
        }

    def _build_control_structure(
        self,
        standard: Standard,
        version: StandardVersion,
    ) -> Dict[str, Any]:
        clauses = (
            self.db.query(Clause)
            .filter(Clause.standard_version_id == version.id)
            .order_by(Clause.code.asc(), Clause.id.asc())
            .all()
        )

        requirements = (
            self.db.query(Requirement)
            .join(Clause, Requirement.clause_id == Clause.id)
            .filter(Clause.standard_version_id == version.id)
            .order_by(Requirement.code.asc(), Requirement.id.asc())
            .all()
        )

        controls = (
            self.db.query(Control)
            .filter(Control.standard_version_id == version.id)
            .order_by(Control.code.asc(), Control.id.asc())
            .all()
        )

        return {
            "standard": standard,
            "version": version,
            "structure_type": "CONTROL_BASED",
            "clauses": clauses,
            "requirements": requirements,
            "controls": controls,
            "process_areas": [],
            "practices": [],
        }

    def _build_maturity_structure(
        self,
        standard: Standard,
        version: StandardVersion,
    ) -> Dict[str, Any]:
        process_areas = (
            self.db.query(StandardProcessArea)
            .filter(
                StandardProcessArea.standard_version_id == version.id
            )
            .order_by(
                StandardProcessArea.sort_order.asc(),
                StandardProcessArea.id.asc(),
            )
            .all()
        )

        process_area_ids = [area.id for area in process_areas]

        practices = []
        if process_area_ids:
            practices = (
                self.db.query(StandardPractice)
                .filter(
                    StandardPractice.process_area_id.in_(process_area_ids)
                )
                .order_by(
                    StandardPractice.process_area_id.asc(),
                    StandardPractice.sort_order.asc(),
                    StandardPractice.id.asc(),
                )
                .all()
            )

        return {
            "standard": standard,
            "version": version,
            "structure_type": "MATURITY_BASED",
            "clauses": [],
            "requirements": [],
            "controls": [],
            "process_areas": process_areas,
            "practices": practices,
        }

    # ------------------------------------------------------------------
    # VALIDATION
    # ------------------------------------------------------------------

    def validate(self, standard_id: int) -> Dict[str, Any]:
        return self.validation.validate_standard(standard_id)

    # ------------------------------------------------------------------
    # IMPORT
    # ------------------------------------------------------------------

    def normalize_import(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return self.import_service.normalize(payload)

    def validate_import(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return self.import_service.validate_shape(payload)

    # ------------------------------------------------------------------
    # PUBLISH
    # ------------------------------------------------------------------

    def publish_version(
        self,
        standard_id: int,
        version_id: int,
    ) -> Dict[str, Any]:
        return self.publish.publish(
            standard_id=standard_id,
            version_id=version_id,
        )

    # ------------------------------------------------------------------
    # TENANT MAPPING / MATRIX PROJECTION
    # ------------------------------------------------------------------

    def mapping_summary(
        self,
        tenant_id: int,
        standard_id: Optional[int] = None,
        instance_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return self.mapping.summarize(
            tenant_id=tenant_id,
            standard_id=standard_id,
            instance_id=instance_id,
        )
