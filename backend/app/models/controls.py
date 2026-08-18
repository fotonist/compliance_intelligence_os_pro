from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class Control(Base):
    __tablename__ = "controls"

    id = Column(Integer, primary_key=True, index=True)

    # Version-aware reference control. A control belongs to a standard version,
    # but it is NOT itself an ISO requirement.
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional legacy/linkage field. Requirement <-> Control mapping is now
    # represented explicitly by MatrixRow and Row Builder. Annex A controls
    # are therefore allowed to exist without a requirement_id.
    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    code = Column(String, nullable=False)
    title = Column(String)
    description = Column(String)

    requirement = relationship("Requirement", back_populates="controls")
    standard_version = relationship("StandardVersion")

    evidences = relationship(
        "Evidence",
        back_populates="control",
        cascade="all, delete-orphan",
    )

    risks = relationship(
        "Risk",
        back_populates="control",
        cascade="all, delete-orphan",
    )

    tasks = relationship(
        "ComplianceTask",
        back_populates="control",
        cascade="all, delete-orphan",
    )
