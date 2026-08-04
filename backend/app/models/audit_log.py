from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String, nullable=True)

    entity_type = Column(String, nullable=False)   # "Risk", "Evidence", "User"
    entity_id = Column(Integer, nullable=True)

    action = Column(String, nullable=False)        # CREATE, UPDATE, STATUS_CHANGE, DELETE
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
