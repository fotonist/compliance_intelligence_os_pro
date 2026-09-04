from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.framework_adoption import (
    FrameworkAdoption,
    FrameworkAdoptionScope,
)
from app.models.tenants import Tenant
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.process import Process


class FrameworkAdoptionService:
    """
    Tenant-specific framework adoption lifecycle.

    Canonical framework/version lifecycle is deliberately kept separate
    from tenant adoption lifecycle.

    Canonical:
        draft / active / published / deprecated

    Adoption:
        DRAFT / CONFIGURING / ACTIVE / SUSPENDED / RETIRED
    """

    ALLOWED_STATUSES = {
        "DRAFT",
        "CONFIGURING",
        "ACTIVE",
        "SUSPENDED",
        "RETIRED",
    }

    ALLOWED_APPLICABILITY = {
        "APPLICABLE",
        "PARTIALLY_APPLICABLE",
        "NOT_APPLICABLE",
    }

    TRANSITIONS = {
        "DRAFT": {"CONFIGURING", "ACTIVE", "RETIRED"},
        "CONFIGURING": {"ACTIVE", "DRAFT", "RETIRED"},
        "ACTIVE": {"SUSPENDED", "RETIRED"},
        "SUSPENDED": {"ACTIVE", "RETIRED"},
        "RETIRED": set(),
    }

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # VALIDATION
    # ------------------------------------------------------------------

    def _resolve_framework(
        self,
        tenant_id: int,
        standard_id: int,
        standard_version_id: int,
    ):
        tenant = (
            self.db.query(Tenant)
            .filter(Tenant.id == tenant_id)
            .first()
        )

        if tenant is None:
            raise ValueError("Tenant not found.")

        if str(tenant.status).lower() != "active":
            raise ValueError("Tenant is not active.")

        standard = (
            self.db.query(Standard)
            .filter(Standard.id == standard_id)
            .first()
        )

        if standard is None:
            raise ValueError("Standard not found.")

        version = (
            self.db.query(StandardVersion)
            .filter(
                StandardVersion.id == standard_version_id,
                StandardVersion.standard_id == standard_id,
            )
            .first()
        )

        if version is None:
            raise ValueError(
                "Standard version does not belong to the selected standard."
            )

        return tenant, standard, version

    def _validate_process(
        self,
        tenant_id: int,
        process_id: int,
    ) -> Process:
        process = (
            self.db.query(Process)
            .filter(
                Process.id == process_id,
                Process.tenant_id == tenant_id,
            )
            .first()
        )

        if process is None:
            raise ValueError(
                "Process not found for the selected tenant."
            )

        return process

    def _serialize(self, adoption: FrameworkAdoption):
        scopes = (
            self.db.query(FrameworkAdoptionScope)
            .filter(
                FrameworkAdoptionScope.adoption_id == adoption.id
            )
            .order_by(FrameworkAdoptionScope.process_id.asc())
            .all()
        )

        return {
            "id": adoption.id,
            "tenant_id": adoption.tenant_id,
            "standard_id": adoption.standard_id,
            "standard_version_id": adoption.standard_version_id,
            "status": adoption.status,
            "applicability": adoption.applicability,
            "effective_date": adoption.effective_date,
            "created_by": adoption.created_by,
            "activated_by": adoption.activated_by,
            "activated_at": adoption.activated_at,
            "created_at": adoption.created_at,
            "updated_at": adoption.updated_at,
            "process_ids": [
                scope.process_id
                for scope in scopes
            ],
        }

    # ------------------------------------------------------------------
    # READ
    # ------------------------------------------------------------------

    def get(
        self,
        tenant_id: int,
        adoption_id: int,
    ) -> Optional[FrameworkAdoption]:
        return (
            self.db.query(FrameworkAdoption)
            .filter(
                FrameworkAdoption.id == adoption_id,
                FrameworkAdoption.tenant_id == tenant_id,
            )
            .first()
        )

    def get_for_version(
        self,
        tenant_id: int,
        standard_version_id: int,
    ) -> Optional[FrameworkAdoption]:
        return (
            self.db.query(FrameworkAdoption)
            .filter(
                FrameworkAdoption.tenant_id == tenant_id,
                FrameworkAdoption.standard_version_id
                == standard_version_id,
            )
            .first()
        )

    def list(
        self,
        tenant_id: int,
        standard_id: Optional[int] = None,
        status: Optional[str] = None,
    ):
        query = (
            self.db.query(FrameworkAdoption)
            .filter(
                FrameworkAdoption.tenant_id == tenant_id
            )
        )

        if standard_id is not None:
            query = query.filter(
                FrameworkAdoption.standard_id == standard_id
            )

        if status is not None:
            normalized_status = status.upper()

            if normalized_status not in self.ALLOWED_STATUSES:
                raise ValueError(
                    f"Invalid adoption status: {status}"
                )

            query = query.filter(
                FrameworkAdoption.status == normalized_status
            )

        return (
            query
            .order_by(FrameworkAdoption.id.desc())
            .all()
        )

    # ------------------------------------------------------------------
    # CREATE
    # ------------------------------------------------------------------

    def create(
        self,
        tenant_id: int,
        standard_id: int,
        standard_version_id: int,
        applicability: str = "APPLICABLE",
        effective_date: Optional[datetime] = None,
        created_by: Optional[int] = None,
    ) -> FrameworkAdoption:

        applicability = applicability.upper()

        if applicability not in self.ALLOWED_APPLICABILITY:
            raise ValueError(
                f"Invalid applicability: {applicability}"
            )

        self._resolve_framework(
            tenant_id=tenant_id,
            standard_id=standard_id,
            standard_version_id=standard_version_id,
        )

        existing = self.get_for_version(
            tenant_id=tenant_id,
            standard_version_id=standard_version_id,
        )

        if existing is not None:
            raise ValueError(
                "This framework version is already adopted by the tenant."
            )

        adoption = FrameworkAdoption(
            tenant_id=tenant_id,
            standard_id=standard_id,
            standard_version_id=standard_version_id,
            status="DRAFT",
            applicability=applicability,
            effective_date=effective_date,
            created_by=created_by,
        )

        self.db.add(adoption)
        self.db.commit()
        self.db.refresh(adoption)

        return adoption

    # ------------------------------------------------------------------
    # UPDATE
    # ------------------------------------------------------------------

    def update(
        self,
        tenant_id: int,
        adoption_id: int,
        applicability: Optional[str] = None,
        effective_date: Optional[datetime] = None,
    ) -> FrameworkAdoption:

        adoption = self.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        if adoption is None:
            raise ValueError("Framework adoption not found.")

        if adoption.status in {"ACTIVE", "RETIRED"}:
            raise ValueError(
                "Active or retired adoption cannot be reconfigured."
            )

        if applicability is not None:
            applicability = applicability.upper()

            if applicability not in self.ALLOWED_APPLICABILITY:
                raise ValueError(
                    f"Invalid applicability: {applicability}"
                )

            adoption.applicability = applicability

        if effective_date is not None:
            adoption.effective_date = effective_date

        if adoption.status == "DRAFT":
            adoption.status = "CONFIGURING"

        self.db.commit()
        self.db.refresh(adoption)

        return adoption

    # ------------------------------------------------------------------
    # SCOPE
    # ------------------------------------------------------------------

    def add_scope(
        self,
        tenant_id: int,
        adoption_id: int,
        process_id: int,
    ) -> FrameworkAdoptionScope:

        adoption = self.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        if adoption is None:
            raise ValueError("Framework adoption not found.")

        if adoption.status in {"ACTIVE", "RETIRED"}:
            raise ValueError(
                "Cannot modify scope of an active or retired adoption."
            )

        self._validate_process(
            tenant_id=tenant_id,
            process_id=process_id,
        )

        existing = (
            self.db.query(FrameworkAdoptionScope)
            .filter(
                FrameworkAdoptionScope.adoption_id == adoption_id,
                FrameworkAdoptionScope.process_id == process_id,
            )
            .first()
        )

        if existing is not None:
            raise ValueError(
                "Process is already included in the adoption scope."
            )

        scope = FrameworkAdoptionScope(
            adoption_id=adoption_id,
            process_id=process_id,
        )

        self.db.add(scope)

        if adoption.status == "DRAFT":
            adoption.status = "CONFIGURING"

        self.db.commit()
        self.db.refresh(scope)

        return scope

    def remove_scope(
        self,
        tenant_id: int,
        adoption_id: int,
        process_id: int,
    ) -> None:

        adoption = self.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        if adoption is None:
            raise ValueError("Framework adoption not found.")

        if adoption.status in {"ACTIVE", "RETIRED"}:
            raise ValueError(
                "Cannot modify scope of an active or retired adoption."
            )

        scope = (
            self.db.query(FrameworkAdoptionScope)
            .filter(
                FrameworkAdoptionScope.adoption_id == adoption_id,
                FrameworkAdoptionScope.process_id == process_id,
            )
            .first()
        )

        if scope is None:
            raise ValueError(
                "Process is not included in the adoption scope."
            )

        self.db.delete(scope)
        self.db.commit()

    # ------------------------------------------------------------------
    # ACTIVE VERSION RESOLUTION

    def resolve_active_version(
        self,
        tenant_id: int,
        standard_id: int,
    ) -> StandardVersion:
        "Resolve the exact framework version actively adopted by a tenant."
        adoption = (
            self.db.query(FrameworkAdoption)
            .filter(
                FrameworkAdoption.tenant_id == tenant_id,
                FrameworkAdoption.standard_id == standard_id,
                FrameworkAdoption.status == "ACTIVE",
            )
            .order_by(FrameworkAdoption.id.desc())
            .first()
        )

        if adoption is None:
            raise ValueError(
                "No active framework adoption exists for this standard."
            )

        version = (
            self.db.query(StandardVersion)
            .filter(
                StandardVersion.id == adoption.standard_version_id,
                StandardVersion.standard_id == standard_id,
            )
            .first()
        )

        if version is None:
            raise ValueError(
                "The active adoption references a missing standard version."
            )

        version_status = str(version.status or "").lower()

        if version_status not in {"published", "active"}:
            raise ValueError(
                "The active adoption references a non-published standard version."
            )

        return version


    # LIFECYCLE
    # ------------------------------------------------------------------

    def transition(
        self,
        tenant_id: int,
        adoption_id: int,
        target_status: str,
        user_id: Optional[int] = None,
    ) -> FrameworkAdoption:

        target_status = target_status.upper()

        if target_status not in self.ALLOWED_STATUSES:
            raise ValueError(
                f"Invalid adoption status: {target_status}"
            )

        adoption = self.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        if adoption is None:
            raise ValueError("Framework adoption not found.")

        current_status = adoption.status.upper()

        if target_status not in self.TRANSITIONS.get(
            current_status,
            set(),
        ):
            raise ValueError(
                f"Invalid adoption transition: "
                f"{current_status} -> {target_status}"
            )

        if target_status == "ACTIVE":
            self._validate_activation(adoption)

        adoption.status = target_status

        if target_status == "ACTIVE":
            adoption.activated_by = user_id
            adoption.activated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(adoption)

        return adoption

    def _validate_activation(
        self,
        adoption: FrameworkAdoption,
    ) -> None:

        version = (
            self.db.query(StandardVersion)
            .filter(
                StandardVersion.id == adoption.standard_version_id,
                StandardVersion.standard_id == adoption.standard_id,
            )
            .first()
        )

        if version is None:
            raise ValueError(
                "Adopted framework version could not be resolved."
            )

        version_status = str(version.status or "").lower()

        if version_status not in {"published", "active"}:
            raise ValueError(
                "Only a published or active framework version can be activated."
            )

        scope_count = (
            self.db.query(FrameworkAdoptionScope)
            .filter(
                FrameworkAdoptionScope.adoption_id == adoption.id
            )
            .count()
        )

        if scope_count == 0:
            raise ValueError(
                "At least one organizational process must be included "
                "in the adoption scope before activation."
            )

    # ------------------------------------------------------------------
    # RESOLVED VIEW
    # ------------------------------------------------------------------

    def resolved(
        self,
        tenant_id: int,
        adoption_id: int,
    ):
        adoption = self.get(
            tenant_id=tenant_id,
            adoption_id=adoption_id,
        )

        if adoption is None:
            raise ValueError("Framework adoption not found.")

        standard = (
            self.db.query(Standard)
            .filter(Standard.id == adoption.standard_id)
            .first()
        )

        version = (
            self.db.query(StandardVersion)
            .filter(
                StandardVersion.id == adoption.standard_version_id
            )
            .first()
        )

        return {
            "adoption": self._serialize(adoption),
            "standard": (
                {
                    "id": standard.id,
                    "code": standard.code,
                    "title": standard.title,
                    "type": standard.type,
                }
                if standard
                else None
            ),
            "version": (
                {
                    "id": version.id,
                    "version_code": version.version_code,
                    "status": version.status,
                }
                if version
                else None
            ),
        }
