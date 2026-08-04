from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)

from sqlalchemy.sql import func

from app.db.base import Base


class TenantPremiumModule(Base):
    __tablename__ = "tenant_premium_modules"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    module_code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    status = Column(
        String(30),
        nullable=False,
        default="ACTIVE",
        index=True,
    )

    activated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    activated_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "module_code",
            name="uq_tenant_premium_module",
        ),
    )