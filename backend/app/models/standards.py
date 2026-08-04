from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class Standard(Base):
    __tablename__ = "standards"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=False)
    title = Column(String)
    description = Column(String)

    # STANDARD META
    type = Column(String(30), nullable=False, default="CONTROL_BASED")

    # ⚠️ Deprecated – versioning artık standard_versions tablosunda
    version = Column(String(50), nullable=True)

    # -----------------------------
    # RELATIONSHIPS
    # -----------------------------

    # ISO / CONTROL_BASED
    clauses = relationship(
        "Clause",
        back_populates="standard",
        cascade="all, delete-orphan"
    )

    # MATURITY_BASED
    process_areas = relationship(
        "StandardProcessArea",
        back_populates="standard",
        cascade="all, delete-orphan"
    )

    capability_levels = relationship(
        "StandardCapabilityLevel",
        back_populates="standard",
        cascade="all, delete-orphan"
    )

    practices = relationship(
        "StandardPractice",
        back_populates="standard",
        cascade="all, delete-orphan"
    )

    maturity_sessions = relationship(
        "MaturityAssessmentSession",
        back_populates="standard",
        cascade="all, delete-orphan"
    )

    # ✅ NEW
    versions = relationship(
        "StandardVersion",
        back_populates="standard",
        cascade="all, delete-orphan"
    )
