from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PamProcessCategory(Base):
    __tablename__ = "pam_process_categories"

    id = Column(Integer, primary_key=True, index=True)
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    framework_model = relationship("FrameworkModel")
    process_groups = relationship("PamProcessGroup", back_populates="category", cascade="all, delete-orphan")
