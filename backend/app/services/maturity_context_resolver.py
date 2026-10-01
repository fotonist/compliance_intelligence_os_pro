from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.framework_adoption import FrameworkAdoption
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.pam_runtime import FrameworkModel


class MaturityContextError(ValueError):
    pass


class MaturityContextNotFoundError(MaturityContextError):
    pass


class MaturityContextConflictError(MaturityContextError):
    pass


@dataclass(frozen=True)
class MaturityContext:
    tenant_id: int
    framework_adoption_id: int
    standard_id: int
    standard_version_id: int

    pam_framework_model_id: int
    capability_framework_model_id: int

    standard_code: str
    standard_type: str
    version_code: str

    pam_framework_model_code: str
    capability_framework_model_code: str

    @property
    def framework_model_id(self) -> int:
        return self.pam_framework_model_id

    @property
    def framework_model_type(self) -> str:
        return "PAM"

    @property
    def framework_model_code(self) -> str:
        return self.pam_framework_model_code


class MaturityContextResolver:
    MATURITY_TYPE = "MATURITY_BASED"
    PAM_MODEL_TYPE = "PAM"
    CAPABILITY_MODEL_TYPE = "CMF"

    @classmethod
    def _resolve_canonical_model(
        cls,
        db: Session,
        *,
        standard_version_id: int,
        model_type: str,
    ) -> FrameworkModel:
        models = (
            db.query(FrameworkModel)
            .filter(
                FrameworkModel.standard_version_id == standard_version_id,
                FrameworkModel.model_type == model_type,
                FrameworkModel.is_canonical.is_(True),
            )
            .order_by(FrameworkModel.id.asc())
            .all()
        )

        if not models:
            raise MaturityContextNotFoundError(
                f"Canonical {model_type} framework model was not found "
                "for the standard version."
            )

        if len(models) > 1:
            raise MaturityContextConflictError(
                f"Multiple canonical {model_type} framework models exist "
                "for the standard version."
            )

        return models[0]

    @classmethod
    def resolve(
        cls,
        db: Session,
        *,
        tenant_id: int,
        framework_adoption_id: int,
    ) -> MaturityContext:
        adoption = (
            db.query(FrameworkAdoption)
            .filter(
                FrameworkAdoption.id == framework_adoption_id,
                FrameworkAdoption.tenant_id == tenant_id,
            )
            .one_or_none()
        )

        if adoption is None:
            raise MaturityContextNotFoundError(
                "Framework adoption was not found for the tenant."
            )

        standard = (
            db.query(Standard)
            .filter(Standard.id == adoption.standard_id)
            .one_or_none()
        )

        if standard is None:
            raise MaturityContextNotFoundError(
                "Standard referenced by framework adoption was not found."
            )

        standard_type = str(standard.type or "").strip().upper()

        if standard_type != cls.MATURITY_TYPE:
            raise MaturityContextConflictError(
                "Framework adoption is not maturity based."
            )

        version = (
            db.query(StandardVersion)
            .filter(
                StandardVersion.id == adoption.standard_version_id,
                StandardVersion.standard_id == adoption.standard_id,
            )
            .one_or_none()
        )

        if version is None:
            raise MaturityContextConflictError(
                "Framework adoption standard version is inconsistent."
            )

        pam_model = cls._resolve_canonical_model(
            db,
            standard_version_id=version.id,
            model_type=cls.PAM_MODEL_TYPE,
        )

        capability_model = cls._resolve_canonical_model(
            db,
            standard_version_id=version.id,
            model_type=cls.CAPABILITY_MODEL_TYPE,
        )

        return MaturityContext(
            tenant_id=tenant_id,
            framework_adoption_id=adoption.id,
            standard_id=standard.id,
            standard_version_id=version.id,
            pam_framework_model_id=pam_model.id,
            capability_framework_model_id=capability_model.id,
            standard_code=str(standard.code),
            standard_type=standard_type,
            version_code=str(version.version_code),
            pam_framework_model_code=str(pam_model.code),
            capability_framework_model_code=str(capability_model.code),
        )
