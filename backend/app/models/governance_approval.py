from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class GovernanceApprovalAuthority(Base):
    __tablename__ = "governance_approval_authorities"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    authority_code = Column(String(100), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    authority_type = Column(String(100), nullable=False, index=True)
    scope = Column(Text, nullable=True)

    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    approval_limit = Column(Numeric(18, 2), nullable=True)
    currency = Column(String(10), nullable=True)

    effective_date = Column(Date, nullable=True)
    review_date = Column(Date, nullable=True)

    status = Column(String(50), nullable=False, default="ACTIVE", server_default="ACTIVE", index=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false", index=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", lazy="joined")
    approver = relationship("User", foreign_keys=[approver_id], lazy="joined")
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
    updater = relationship("User", foreign_keys=[updated_by], lazy="joined")

    delegations = relationship(
        "GovernanceDelegation",
        back_populates="authority",
        cascade="all, delete-orphan",
    )

    history = relationship(
        "GovernanceApprovalHistory",
        back_populates="authority",
        cascade="all, delete-orphan",
        order_by="GovernanceApprovalHistory.created_at.desc()",
        foreign_keys="GovernanceApprovalHistory.authority_id",
    )


class GovernanceDelegation(Base):
    __tablename__ = "governance_delegations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    authority_id = Column(Integer, ForeignKey("governance_approval_authorities.id", ondelete="CASCADE"), nullable=True, index=True)

    delegation_code = Column(String(100), nullable=False, index=True)
    name = Column(String(500), nullable=False)

    delegator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    delegate_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    scope = Column(Text, nullable=True)
    authority_limit = Column(Numeric(18, 2), nullable=True)
    currency = Column(String(10), nullable=True)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    reason = Column(Text, nullable=True)

    status = Column(String(50), nullable=False, default="ACTIVE", server_default="ACTIVE", index=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false", index=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", lazy="joined")
    authority = relationship("GovernanceApprovalAuthority", back_populates="delegations")

    delegator = relationship("User", foreign_keys=[delegator_id], lazy="joined")
    delegate = relationship("User", foreign_keys=[delegate_id], lazy="joined")
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
    updater = relationship("User", foreign_keys=[updated_by], lazy="joined")

    history = relationship(
        "GovernanceApprovalHistory",
        back_populates="delegation",
        cascade="all, delete-orphan",
        order_by="GovernanceApprovalHistory.created_at.desc()",
        foreign_keys="GovernanceApprovalHistory.delegation_id",
    )


class GovernanceApprovalHistory(Base):
    __tablename__ = "governance_approval_history"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    authority_id = Column(Integer, ForeignKey("governance_approval_authorities.id", ondelete="CASCADE"), nullable=True, index=True)
    delegation_id = Column(Integer, ForeignKey("governance_delegations.id", ondelete="CASCADE"), nullable=True, index=True)

    action = Column(String(100), nullable=False, index=True)
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)

    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "authority_id"],
            ["governance_approval_authorities.tenant_id", "governance_approval_authorities.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "delegation_id"],
            ["governance_delegations.tenant_id", "governance_delegations.id"],
            ondelete="CASCADE",
        ),
    )

    tenant = relationship("Tenant", lazy="joined")
    authority = relationship(
        "GovernanceApprovalAuthority",
        back_populates="history",
        foreign_keys=[authority_id],
    )
    delegation = relationship(
        "GovernanceDelegation",
        back_populates="history",
        foreign_keys=[delegation_id],
    )
    performer = relationship("User", foreign_keys=[performed_by], lazy="joined")
