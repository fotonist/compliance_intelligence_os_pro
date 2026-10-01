# C:\Projects\compliance_intelligence_os\backend\app\models\user.py

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    # ==========================================================
    # Identity
    # ==========================================================

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    email = Column(
        String,
        unique=True,
        nullable=False,
        index=True,
    )

    hashed_password = Column(
        String,
        nullable=False,
    )

    full_name = Column(
        String,
        nullable=True,
    )

    # ==========================================================
    # Account
    # ==========================================================

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_locked = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    failed_login_attempts = Column(
        Integer,
        default=0,
        nullable=False,
    )

    must_change_password = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    mfa_enabled = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    # ==========================================================
    # Profile
    # ==========================================================

    phone = Column(String(50))


    email_verified_at = Column(
        DateTime,
        nullable=True,
    )

    phone_verified_at = Column(
        DateTime,
        nullable=True,
    )
    language = Column(
        String(20),
        default="en",
    )

    timezone = Column(
        String(100),
        default="UTC",
    )

    # ==========================================================
    # Dates
    # ==========================================================

    last_login_at = Column(DateTime)

    password_last_changed = Column(DateTime)

    created_at = Column(
        DateTime,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ==========================================================
    # Audit
    # ==========================================================

    created_by = Column(Integer)

    updated_by = Column(Integer)

    # ==========================================================
    # Organization
    # ==========================================================

    manager_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    manager = relationship(
        "User",
        remote_side=[id],
        foreign_keys=[manager_id],
    )

    # ==========================================================
    # Relationships
    # ==========================================================

    tenant = relationship(
        "Tenant",
        lazy="joined",
    )

    roles = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
    )

    actions = relationship(
        "Action",
        back_populates="user",
        cascade="all, delete",
    )

    audit_logs = relationship(
        "AuditLog",
        back_populates="user",
        cascade="all, delete",
    )
