from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DateTime,
    func,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class TaskEvidenceLink(Base):

    __tablename__ = "task_evidence_links"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    task_id = Column(
        Integer,
        ForeignKey(
            "compliance_tasks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    evidence_id = Column(
        Integer,
        ForeignKey(
            "evidences.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    task = relationship(
        "ComplianceTask",
        back_populates="evidence_links",
    )

    evidence = relationship(
        "Evidence",
        back_populates="task_links",
    )
