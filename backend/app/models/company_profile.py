from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id = Column(Integer, primary_key=True)

    # 🔐 Tenant Isolation
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Basic Info ---
    legal_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)
    registration_no = Column(String(100), nullable=True)
    industry = Column(String(255), nullable=True)
    employee_count = Column(Integer, nullable=True)
    headquarters_address = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)

    # --- Context ---
    internal_issues = Column(Text, nullable=True)
    external_issues = Column(Text, nullable=True)
    strategic_objectives = Column(Text, nullable=True)

    # --- Scope ---
    scope_description = Column(Text, nullable=True)
    excluded_activities = Column(Text, nullable=True)

    # --- Status ---
    status = Column(String(50), default="draft", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
