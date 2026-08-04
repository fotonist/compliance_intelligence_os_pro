from sqlalchemy import Column, Integer, ForeignKey, DateTime, String
from sqlalchemy.sql import func
from app.db.base import Base


class ProcessRiskLinkAudit(Base):
    __tablename__ = "process_risk_link_audit"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(Integer, nullable=False, index=True)

    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    risk_id = Column(
        Integer,
        ForeignKey("risks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    action = Column(String(20), nullable=False)  # LINKED / UNLINKED

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
