from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class ControlAssessment(Base):
    __tablename__ = "control_assessments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    scope = Column(String, nullable=True)
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)
    status = Column(String(30), default="DRAFT")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
