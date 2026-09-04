from typing import Optional

from sqlalchemy.orm import Session

from app.models.standard_versions import StandardVersion


class FrameworkVersionService:

    ALLOWED_STATUSES = {
        "draft",
        "active",
        "published",
        "deprecated",
    }

    def __init__(self, db: Session):
        self.db = db

    def get_version(
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

    def list_versions(
        self,
        standard_id: int,
    ):
        return (
            self.db.query(StandardVersion)
            .filter(StandardVersion.standard_id == standard_id)
            .order_by(StandardVersion.created_at.desc())
            .all()
        )

    def set_status(
        self,
        version: StandardVersion,
        status: str,
    ) -> StandardVersion:
        if status not in self.ALLOWED_STATUSES:
            raise ValueError(
                f"Invalid framework version status: {status}"
            )

        version.status = status
        self.db.flush()

        return version
