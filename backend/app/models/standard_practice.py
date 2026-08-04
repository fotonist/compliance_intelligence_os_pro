from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    SmallInteger,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base


class StandardPractice(Base):
    __tablename__ = "standard_practices"

    id = Column(Integer, primary_key=True)

    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    process_area_id = Column(
        Integer,
        ForeignKey("standard_process_areas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    level = Column(SmallInteger, nullable=False)

    code = Column(String(100))
    title = Column(String(255))
    text = Column(Text, nullable=False)
    guidance = Column(Text)

    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # ✅ RELATIONS
    standard = relationship(
        "Standard",
        back_populates="practices",
    )

    process_area = relationship(
        "StandardProcessArea",
        back_populates="practices",
    )

    maturity_evaluations = relationship(
        "MaturityPracticeEvaluation",
        back_populates="practice",
        cascade="all, delete-orphan",
    )
