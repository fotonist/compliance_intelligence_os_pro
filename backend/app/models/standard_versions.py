from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class StandardVersion(Base):
    __tablename__ = "standard_versions"

    id = Column(Integer, primary_key=True, index=True)

    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version_code = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="draft")

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    # -----------------------------
    # RELATIONSHIPS
    # -----------------------------

    standard = relationship(
        "Standard",
        back_populates="versions",
    )

    clauses = relationship(
        "Clause",
        back_populates="standard_version",
        cascade="all, delete-orphan",
    )

    process_areas = relationship(
        "StandardProcessArea",
        back_populates="standard_version",
        cascade="all, delete-orphan",
    )
