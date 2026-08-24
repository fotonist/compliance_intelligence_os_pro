from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Text,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class EvidenceFileHistory(Base):

    __tablename__ = "evidence_file_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    evidence_file_id = Column(
        Integer,
        ForeignKey(
            "evidence_files.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    action = Column(
        String,
        nullable=True,
    )

    old_status = Column(
        String,
        nullable=True,
    )

    new_status = Column(
        String,
        nullable=True,
    )

    comment = Column(
        Text,
        nullable=True,
    )

    performed_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=True,
    )

    evidence_file = relationship(
        "EvidenceFile",
        backref="history",
        passive_deletes=True,
    )

    user = relationship(
        "User",
        lazy="joined",
    )
