from sqlalchemy import Column, Integer, DateTime, JSON, ForeignKey, String
from sqlalchemy.sql import func
from app.db.base import Base


class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    scope = Column(String(64), nullable=False, index=True)

    summary = Column(String, nullable=False)
    root_causes = Column(JSON, nullable=False, default=list)
    warnings = Column(JSON, nullable=False, default=list)
    actions = Column(JSON, nullable=False, default=list)

    kpi_snapshot = Column(JSON, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
