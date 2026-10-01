from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.pam_runtime import FrameworkModel


STANDARD_CODE = "ISO15504"
VERSION_CODE = "2012"

PAM_CODE = "ISO15504-5-2012-PAM"
CMF_CODE = "ISO15504-2-2003-CMF"


def seed_iso15504_2012_framework(db: Session) -> dict[str, int]:
    standard = (
        db.query(Standard)
        .filter(Standard.code == STANDARD_CODE)
        .one()
    )

    if standard.type != "MATURITY_BASED":
        raise RuntimeError(
            f"Standard {STANDARD_CODE} is not MATURITY_BASED"
        )

    version = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == standard.id,
            StandardVersion.version_code == VERSION_CODE,
        )
        .one_or_none()
    )

    if version is None:
        version = StandardVersion(
            standard_id=standard.id,
            version_code=VERSION_CODE,
            status="draft",
        )
        db.add(version)
        db.flush()

    pam = (
        db.query(FrameworkModel)
        .filter(
            FrameworkModel.standard_version_id == version.id,
            FrameworkModel.model_type == "PAM",
            FrameworkModel.code == PAM_CODE,
        )
        .one_or_none()
    )

    if pam is None:
        pam = FrameworkModel(
            standard_version_id=version.id,
            model_type="PAM",
            code=PAM_CODE,
            name=(
                "ISO/IEC 15504-5:2012 Exemplar Software "
                "Life Cycle Process Assessment Model"
            ),
            description=None,
            status="draft",
            is_canonical=True,
            model_metadata={
                "standard_part": "ISO/IEC 15504-5",
                "edition": "2012",
                "language": "en",
            },
        )
        db.add(pam)
        db.flush()

    cmf = (
        db.query(FrameworkModel)
        .filter(
            FrameworkModel.standard_version_id == version.id,
            FrameworkModel.model_type == "CMF",
            FrameworkModel.code == CMF_CODE,
        )
        .one_or_none()
    )

    if cmf is None:
        cmf = FrameworkModel(
            standard_version_id=version.id,
            model_type="CMF",
            code=CMF_CODE,
            name="ISO/IEC 15504-2:2003 Capability Measurement Framework",
            description=None,
            status="draft",
            is_canonical=True,
            model_metadata={
                "standard_part": "ISO/IEC 15504-2",
                "edition": "2003",
                "language": "en",
                "referenced_by": "ISO/IEC 15504-5:2012",
            },
        )
        db.add(cmf)
        db.flush()

    return {
        "standard_id": standard.id,
        "standard_version_id": version.id,
        "pam_framework_model_id": pam.id,
        "cmf_framework_model_id": cmf.id,
    }
