from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control


class FrameworkResolutionService:

    def __init__(self, db: Session):
        self.db = db

    def resolve_standard(self, standard_id: int) -> Optional[Standard]:
        return (
            self.db.query(Standard)
            .filter(Standard.id == standard_id)
            .first()
        )

    def resolve_version(
        self,
        standard_version_id: int,
    ) -> Optional[StandardVersion]:
        return (
            self.db.query(StandardVersion)
            .filter(StandardVersion.id == standard_version_id)
            .first()
        )

    def resolve_version_for_standard(
        self,
        standard_id: int,
        version_code: str,
    ) -> Optional[StandardVersion]:
        return (
            self.db.query(StandardVersion)
            .filter(
                StandardVersion.standard_id == standard_id,
                StandardVersion.version_code == version_code,
            )
            .first()
        )

    def resolve_clause(self, clause_id: int) -> Optional[Clause]:
        return (
            self.db.query(Clause)
            .filter(Clause.id == clause_id)
            .first()
        )

    def resolve_requirement(
        self,
        requirement_id: int,
    ) -> Optional[Requirement]:
        return (
            self.db.query(Requirement)
            .filter(Requirement.id == requirement_id)
            .first()
        )

    def resolve_control(self, control_id: int) -> Optional[Control]:
        return (
            self.db.query(Control)
            .filter(Control.id == control_id)
            .first()
        )

    def control_context(
        self,
        control_id: int,
    ) -> Optional[Dict[str, Any]]:
        control = self.resolve_control(control_id)

        if control is None:
            return None

        version = self.resolve_version(control.standard_version_id)

        if version is None:
            return None

        standard = self.resolve_standard(version.standard_id)

        if standard is None:
            return None

        return {
            "standard_id": standard.id,
            "standard_code": standard.code,
            "standard_title": standard.title,
            "standard_version_id": version.id,
            "version_code": version.version_code,
            "control_id": control.id,
            "control_code": control.code,
            "control_title": control.title,
        }

    def requirement_context(
        self,
        requirement_id: int,
    ) -> Optional[Dict[str, Any]]:
        requirement = self.resolve_requirement(requirement_id)

        if requirement is None:
            return None

        clause = self.resolve_clause(requirement.clause_id)

        if clause is None:
            return None

        version = self.resolve_version(clause.standard_version_id)

        if version is None:
            return None

        standard = self.resolve_standard(version.standard_id)

        if standard is None:
            return None

        return {
            "standard_id": standard.id,
            "standard_code": standard.code,
            "standard_title": standard.title,
            "standard_version_id": version.id,
            "version_code": version.version_code,
            "clause_id": clause.id,
            "clause_code": clause.code,
            "clause_title": clause.title,
            "requirement_id": requirement.id,
            "requirement_code": requirement.code,
            "requirement_title": requirement.title,
        }
