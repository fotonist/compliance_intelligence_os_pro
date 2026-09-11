from types import SimpleNamespace
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice
from app.models.framework_model import FrameworkModel
from app.models.pam_process_category import PamProcessCategory
from app.models.pam_definition import PamProcessGroup, PamProcess
from app.models.pam_capability import PamCapabilityLevel, PamProcessAttribute

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

    ISO/IEC 15504 canonical PAM yapısı için legacy
    StandardProcessArea/StandardPractice projection'ı kullanılmaz.
    """

    def __init__(self, db: Session):
        self.db = db
        self.resolution = FrameworkResolutionService(db)
        self.validation = FrameworkValidationService(db)
        self.version = FrameworkVersionService(db)
        self.import_service = FrameworkImportService(db)
        self.publish = FrameworkPublishService(db)
        self.mapping = FrameworkMappingService(db)

    def list_standards(self) -> List[Standard]:
        return (
            self.db.query(Standard)
            .order_by(Standard.code.asc(), Standard.id.asc())
            .all()
        )

    def get_standard(self, standard_id: int) -> Optional[Standard]:
        return self.resolution.resolve_standard(standard_id)

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
                return self._build_maturity_structure(standard, version)

            return self._build_control_structure(standard, version)

        return {
            "standard": standard,
            "structure_type": structure_type,
            "versions": self.version.list_versions(standard_id),
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
        pam = (
            self.db.query(FrameworkModel)
            .filter(
                FrameworkModel.standard_version_id == version.id,
                FrameworkModel.model_type == "PAM",
                FrameworkModel.is_canonical.is_(True),
            )
            .order_by(FrameworkModel.id.asc())
            .first()
        )

        if pam is None:
            return self._build_legacy_maturity_structure(standard, version)

        categories = (
            self.db.query(PamProcessCategory)
            .filter(PamProcessCategory.framework_model_id == pam.id)
            .order_by(PamProcessCategory.sort_order.asc(), PamProcessCategory.id.asc())
            .all()
        )
        groups = (
            self.db.query(PamProcessGroup)
            .join(PamProcessCategory, PamProcessGroup.category_id == PamProcessCategory.id)
            .filter(PamProcessCategory.framework_model_id == pam.id)
            .order_by(
                PamProcessGroup.category_id.asc(),
                PamProcessGroup.sort_order.asc(),
                PamProcessGroup.id.asc(),
            )
            .all()
        )
        processes = (
            self.db.query(PamProcess)
            .filter(PamProcess.framework_model_id == pam.id)
            .order_by(
                PamProcess.process_group_id.asc(),
                PamProcess.sort_order.asc(),
                PamProcess.id.asc(),
            )
            .all()
        )

        groups_by_category: Dict[int, List[Any]] = {}
        for group in groups:
            groups_by_category.setdefault(group.category_id, []).append(
                SimpleNamespace(
                    id=group.id,
                    code=group.code,
                    name=group.name,
                    description=group.description,
                    sort_order=group.sort_order,
                    process_area_id=group.category_id,
                    title=group.name,
                    text=group.description,
                    guidance=None,
                    level=None,
                    is_active=True,
                )
            )

        category_adapters = [
            SimpleNamespace(
                id=category.id,
                code=category.code,
                name=category.name,
                description=category.description,
                sort_order=category.sort_order,
                practices=groups_by_category.get(category.id, []),
            )
            for category in categories
        ]

        process_adapters = [
            SimpleNamespace(
                id=process.id,
                code=process.code,
                title=process.name,
                text=process.description,
                guidance=process.purpose,
                level=None,
                process_area_id=process.process_group_id,
                is_active=True,
                sort_order=process.sort_order,
            )
            for process in processes
        ]

        capability_model = (
            self.db.query(FrameworkModel)
            .filter(
                FrameworkModel.standard_version_id == version.id,
                FrameworkModel.model_type == "CMF",
                FrameworkModel.is_canonical.is_(True),
            )
            .order_by(FrameworkModel.id.asc())
            .first()
        )

        capability_levels: List[Dict[str, Any]] = []
        process_attributes: List[Dict[str, Any]] = []
        if capability_model:
            levels = (
                self.db.query(PamCapabilityLevel)
                .filter(PamCapabilityLevel.framework_model_id == capability_model.id)
                .order_by(PamCapabilityLevel.level.asc(), PamCapabilityLevel.id.asc())
                .all()
            )
            capability_levels = [
                {
                    "id": level.id,
                    "level": level.level,
                    "code": level.code,
                    "name": level.name,
                    "description": level.description,
                    "sort_order": level.sort_order,
                }
                for level in levels
            ]
            if levels:
                level_ids = [level.id for level in levels]
                attributes = (
                    self.db.query(PamProcessAttribute)
                    .filter(PamProcessAttribute.capability_level_id.in_(level_ids))
                    .order_by(
                        PamProcessAttribute.capability_level_id.asc(),
                        PamProcessAttribute.sort_order.asc(),
                        PamProcessAttribute.id.asc(),
                    )
                    .all()
                )
                process_attributes = [
                    {
                        "id": attribute.id,
                        "capability_level_id": attribute.capability_level_id,
                        "code": attribute.code,
                        "name": attribute.name,
                        "description": attribute.description,
                        "sort_order": attribute.sort_order,
                    }
                    for attribute in attributes
                ]

        return {
            "standard": standard,
            "version": version,
            "structure_type": "MATURITY_BASED",
            "framework_model": {
                "id": pam.id,
                "model_type": pam.model_type,
                "code": pam.code,
                "name": pam.name,
                "description": pam.description,
            },
            "clauses": [],
            "requirements": [],
            "controls": [],
            "process_areas": category_adapters,
            "practices": process_adapters,
            "process_groups": [
                {
                    "id": group.id,
                    "category_id": group.category_id,
                    "code": group.code,
                    "name": group.name,
                    "description": group.description,
                    "sort_order": group.sort_order,
                }
                for group in groups
            ],
            "process_count": len(processes),
            "process_group_count": len(groups),
            "process_category_count": len(categories),
            "capability_levels": capability_levels,
            "process_attributes": process_attributes,
        }

    def _build_legacy_maturity_structure(
        self,
        standard: Standard,
        version: StandardVersion,
    ) -> Dict[str, Any]:
        process_areas = (
            self.db.query(StandardProcessArea)
            .filter(StandardProcessArea.standard_version_id == version.id)
            .order_by(StandardProcessArea.sort_order.asc(), StandardProcessArea.id.asc())
            .all()
        )
        process_area_ids = [area.id for area in process_areas]
        practices = []
        if process_area_ids:
            practices = (
                self.db.query(StandardPractice)
                .filter(StandardPractice.process_area_id.in_(process_area_ids))
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

    def validate(self, standard_id: int) -> Dict[str, Any]:
        return self.validation.validate_standard(standard_id)

    def normalize_import(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.import_service.normalize(payload)

    def validate_import(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.import_service.validate_shape(payload)

    def publish_version(self, standard_id: int, version_id: int) -> Dict[str, Any]:
        return self.publish.publish(standard_id=standard_id, version_id=version_id)

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
