from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.base import Base


class FrameworkAdoption(Base):
    __tablename__ = "framework_adoptions"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status = Column(
        String(32),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    applicability = Column(
        String(32),
        nullable=False,
        default="APPLICABLE",
    )

    effective_date = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by = Column(
        Integer,
        nullable=True,
    )

    activated_by = Column(
        Integer,
        nullable=True,
    )

    activated_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class FrameworkAdoptionScope(Base):
    __tablename__ = "framework_adoption_scopes"

    id = Column(Integer, primary_key=True, index=True)

    adoption_id = Column(
        Integer,
        ForeignKey(
            "framework_adoptions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    process_id = Column(
        Integer,
        ForeignKey(
            "processes.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
