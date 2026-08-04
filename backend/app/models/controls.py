from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Control(Base):
    __tablename__ = "controls"

    id = Column(Integer, primary_key=True, index=True)

    # 🔒 Version-aware
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String, nullable=False)
    title = Column(String)
    description = Column(String)

    # -----------------
    # RELATIONSHIPS
    # -----------------
    requirement = relationship("Requirement", back_populates="controls")

    standard_version = relationship("StandardVersion")

    evidences = relationship(
        "Evidence",
        back_populates="control",
        cascade="all, delete-orphan"
    )

    risks = relationship(
        "Risk",
        back_populates="control",
        cascade="all, delete-orphan"
    )
    tasks = relationship(
    "ComplianceTask",
    back_populates="control",
    cascade="all, delete-orphan",
)