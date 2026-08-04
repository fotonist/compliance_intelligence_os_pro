from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base


class EvidenceHistory(Base):
    __tablename__ = "evidence_history"

    id = Column(Integer, primary_key=True, index=True)

    # FK
    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Audit info
    action = Column(String(50), nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)

    performed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # -----------------------------
    # Relationships
    # -----------------------------
    evidence = relationship(
        "Evidence",
        backref="history",
        passive_deletes=True,
    )

    user = relationship(
        "User",
        lazy="joined",
    )
