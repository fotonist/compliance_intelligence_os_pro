from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PamCapabilityLevel(Base):
    __tablename__ = "pam_capability_levels"

    id = Column(Integer, primary_key=True, index=True)
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="CASCADE"), nullable=False, index=True)
    level = Column(Integer, nullable=False)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    framework_model = relationship("FrameworkModel")
    attributes = relationship("PamProcessAttribute", back_populates="capability_level", cascade="all, delete-orphan")


class PamProcessAttribute(Base):
    __tablename__ = "pam_process_attributes"

    id = Column(Integer, primary_key=True, index=True)
    capability_level_id = Column(Integer, ForeignKey("pam_capability_levels.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    capability_level = relationship("PamCapabilityLevel", back_populates="attributes")
    generic_practices = relationship("PamGenericPractice", back_populates="process_attribute", cascade="all, delete-orphan")
    generic_resources = relationship("PamGenericResource", back_populates="process_attribute", cascade="all, delete-orphan")
    generic_work_products = relationship("PamGenericWorkProduct", back_populates="process_attribute", cascade="all, delete-orphan")


class PamGenericPractice(Base):
    __tablename__ = "pam_generic_practices"

    id = Column(Integer, primary_key=True, index=True)
    process_attribute_id = Column(Integer, ForeignKey("pam_process_attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    process_attribute = relationship("PamProcessAttribute", back_populates="generic_practices")


class PamGenericResource(Base):
    __tablename__ = "pam_generic_resources"

    id = Column(Integer, primary_key=True, index=True)
    process_attribute_id = Column(Integer, ForeignKey("pam_process_attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    process_attribute = relationship("PamProcessAttribute", back_populates="generic_resources")


class PamGenericWorkProduct(Base):
    __tablename__ = "pam_generic_work_products"

    id = Column(Integer, primary_key=True, index=True)
    process_attribute_id = Column(Integer, ForeignKey("pam_process_attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    process_attribute = relationship("PamProcessAttribute", back_populates="generic_work_products")
