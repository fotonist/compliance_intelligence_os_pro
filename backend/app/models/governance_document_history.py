from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class GovernanceDocumentHistory(Base):

    __tablename__ = "governance_document_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    document_id = Column(
        Integer,
        ForeignKey(
            "governance_procedure_documents.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    action = Column(
        String(50),
        nullable=False,
    )

    old_status = Column(
        String(50),
        nullable=True,
    )

    new_status = Column(
        String(50),
        nullable=True,
    )

    comment = Column(
        String(2000),
        nullable=True,
    )

    performed_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    document = relationship(
        "GovernanceProcedureDocument",
        backref="history",
        passive_deletes=True,
    )

    user = relationship(
        "User",
        lazy="joined",
    )