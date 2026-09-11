from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PamProcessGroup(Base):
    __tablename__ = "pam_process_groups"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("pam_process_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    category = relationship("PamProcessCategory", back_populates="process_groups")
    processes = relationship("PamProcess", back_populates="process_group", cascade="all, delete-orphan")


class PamProcess(Base):
    __tablename__ = "pam_processes"

    id = Column(Integer, primary_key=True, index=True)
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="CASCADE"), nullable=False, index=True)
    process_group_id = Column(Integer, ForeignKey("pam_process_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    purpose = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    framework_model = relationship("FrameworkModel")
    process_group = relationship("PamProcessGroup", back_populates="processes")
    outcomes = relationship("PamProcessOutcome", back_populates="process", cascade="all, delete-orphan")
    base_practices = relationship("PamBasePractice", back_populates="process", cascade="all, delete-orphan")
    work_products = relationship("PamProcessWorkProduct", back_populates="process", cascade="all, delete-orphan")


class PamProcessOutcome(Base):
    __tablename__ = "pam_process_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("pam_processes.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    process = relationship("PamProcess", back_populates="outcomes")
    base_practice_links = relationship("PamBasePracticeOutcome", back_populates="outcome", cascade="all, delete-orphan")


class PamBasePractice(Base):
    __tablename__ = "pam_base_practices"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("pam_processes.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    process = relationship("PamProcess", back_populates="base_practices")
    outcome_links = relationship("PamBasePracticeOutcome", back_populates="base_practice", cascade="all, delete-orphan")


class PamBasePracticeOutcome(Base):
    __tablename__ = "pam_base_practice_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    base_practice_id = Column(Integer, ForeignKey("pam_base_practices.id", ondelete="CASCADE"), nullable=False, index=True)
    outcome_id = Column(Integer, ForeignKey("pam_process_outcomes.id", ondelete="CASCADE"), nullable=False, index=True)

    base_practice = relationship("PamBasePractice", back_populates="outcome_links")
    outcome = relationship("PamProcessOutcome", back_populates="base_practice_links")


class PamWorkProduct(Base):
    __tablename__ = "pam_work_products"

    id = Column(Integer, primary_key=True, index=True)
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    characteristics = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    framework_model = relationship("FrameworkModel")
    process_links = relationship("PamProcessWorkProduct", back_populates="work_product", cascade="all, delete-orphan")


class PamProcessWorkProduct(Base):
    __tablename__ = "pam_process_work_products"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("pam_processes.id", ondelete="CASCADE"), nullable=False, index=True)
    work_product_id = Column(Integer, ForeignKey("pam_work_products.id", ondelete="CASCADE"), nullable=False, index=True)
    direction = Column(String(20), nullable=False, default="BOTH")
    sort_order = Column(Integer, nullable=False, default=0)

    process = relationship("PamProcess", back_populates="work_products")
    work_product = relationship("PamWorkProduct", back_populates="process_links")
