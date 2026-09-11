from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class FrameworkRelationship(Base):
    __tablename__ = "framework_relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type = Column(String(50), nullable=False, index=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    source_model = relationship(
        "FrameworkModel",
        foreign_keys=[source_model_id],
        back_populates="outgoing_relationships",
    )

    target_model = relationship(
        "FrameworkModel",
        foreign_keys=[target_model_id],
        back_populates="incoming_relationships",
    )
