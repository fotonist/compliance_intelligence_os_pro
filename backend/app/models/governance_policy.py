from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Boolean,
    func,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class GovernancePolicy(Base):

    __tablename__ = "governance_policies"

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

    policy_code = Column(
        String,
        nullable=False,
    )

    title = Column(
        String,
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    category = Column(
        String,
        nullable=True,
        default="other",
    )

    status = Column(
        String,
        nullable=True,
        default="draft",
        index=True,
    )

    version = Column(
        String,
        nullable=True,
        default="1.0",
    )

    owner_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    approver_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    effective_date = Column(
        DateTime,
        nullable=True,
    )

    review_date = Column(
        DateTime,
        nullable=True,
    )

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner = relationship(
        "User",
        foreign_keys=[owner_id],
        lazy="joined",
    )

    approver = relationship(
        "User",
        foreign_keys=[approver_id],
        lazy="joined",
    )