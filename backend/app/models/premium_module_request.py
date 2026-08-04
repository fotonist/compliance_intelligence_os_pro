from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PremiumModuleRequest(Base):
    __tablename__ = "premium_module_requests"


    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )


    # ==========================
    # Tenant
    # ==========================

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )


    # ==========================
    # Request Owner
    # ==========================

    requested_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )


    # ==========================
    # Premium Module
    # ==========================

    module_code = Column(
        String(100),
        nullable=False,
        index=True,
    )


    module_name = Column(
        String(255),
        nullable=False,
    )


    # ==========================
    # Workflow
    # ==========================

    status = Column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )


    # ==========================
    # Audit
    # ==========================

    requested_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


    reviewed_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )


    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )


    review_note = Column(
        Text,
        nullable=True,
    )


    # ==========================
    # Relationships
    # ==========================

    tenant = relationship(
        "Tenant",
        lazy="joined",
    )


    requester = relationship(
        "User",
        foreign_keys=[requested_by],
        lazy="joined",
    )


    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
        lazy="joined",
    )