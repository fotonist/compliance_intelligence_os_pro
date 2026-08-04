from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class Clause(Base):
    __tablename__ = "clauses"

    id = Column(Integer, primary_key=True, index=True)

    # ⚠️ Legacy (korunuyor)
    standard_id = Column(Integer, ForeignKey("standards.id"))

    # ✅ NEW – version-aware
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String, nullable=False)
    title = Column(String)
    description = Column(String)

    # -----------------------------
    # RELATIONSHIPS
    # -----------------------------

    standard = relationship(
        "Standard",
        back_populates="clauses"
    )

    standard_version = relationship(
        "StandardVersion",
        back_populates="clauses"
    )

    requirements = relationship(
        "Requirement",
        back_populates="clause",
        cascade="all, delete-orphan"
    )
