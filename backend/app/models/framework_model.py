from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class FrameworkModel(Base):
    __tablename__ = "framework_models"

    id = Column(Integer, primary_key=True, index=True)
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model_type = Column(String(50), nullable=False, index=True)
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft", index=True)
    is_canonical = Column(Boolean, nullable=False, default=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    standard_version = relationship(
        "StandardVersion",
        back_populates="framework_models",
    )

    outgoing_relationships = relationship(
        "FrameworkRelationship",
        foreign_keys="FrameworkRelationship.source_model_id",
        back_populates="source_model",
        cascade="all, delete-orphan",
    )

    incoming_relationships = relationship(
        "FrameworkRelationship",
        foreign_keys="FrameworkRelationship.target_model_id",
        back_populates="target_model",
        cascade="all, delete-orphan",
    )
