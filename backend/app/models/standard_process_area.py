from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class StandardProcessArea(Base):
    __tablename__ = "standard_process_areas"

    id = Column(Integer, primary_key=True)

    # ⚠️ Legacy
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)

    # ✅ NEW – version-aware
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String(50))
    name = Column(String(255), nullable=False)
    description = Column(Text)

    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # -----------------------------
    # RELATIONSHIPS
    # -----------------------------

    standard = relationship(
        "Standard",
        back_populates="process_areas"
    )

    standard_version = relationship(
        "StandardVersion",
        back_populates="process_areas"
    )

    practices = relationship(
        "StandardPractice",
        back_populates="process_area",
        cascade="all, delete-orphan"
    )
