from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class DecisionRegister(Base):
    __tablename__ = "decision_registers"

    # ==========================================================
    # Identity
    # ==========================================================

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

    decision_code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    title = Column(
        String(500),
        nullable=False,
    )

    # ==========================================================
    # Classification / Lifecycle
    # ==========================================================

    decision_type = Column(
        String(100),
        nullable=False,
        default="governance",
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
        index=True,
    )

    priority = Column(
        String(30),
        nullable=False,
        default="medium",
        index=True,
    )

    # ==========================================================
    # Decision Governance
    # ==========================================================

    decision_date = Column(
        DateTime,
        nullable=True,
        index=True,
    )

    decision_maker_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    owner_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    approver_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    approval_date = Column(
        DateTime,
        nullable=True,
    )

    review_date = Column(
        DateTime,
        nullable=True,
        index=True,
    )

    # ==========================================================
    # Decision Content
    # ==========================================================

    context = Column(
        Text,
        nullable=True,
    )

    rationale = Column(
        Text,
        nullable=True,
    )

    decision_statement = Column(
        Text,
        nullable=False,
    )

    expected_outcome = Column(
        Text,
        nullable=True,
    )

    impact_assessment = Column(
        Text,
        nullable=True,
    )

    # ==========================================================
    # Governance References
    # ==========================================================

    policy_id = Column(
        Integer,
        ForeignKey(
            "governance_policies.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    procedure_id = Column(
        Integer,
        ForeignKey(
            "governance_procedures.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # ==========================================================
    # Audit / Lifecycle
    # ==========================================================

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    updated_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
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

    # ==========================================================
    # Relationships
    # ==========================================================

    tenant = relationship(
        "Tenant",
        lazy="joined",
    )

    decision_maker = relationship(
        "User",
        foreign_keys=[decision_maker_id],
        lazy="joined",
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

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="joined",
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="joined",
    )

    policy = relationship(
        "GovernancePolicy",
        lazy="joined",
    )

    procedure = relationship(
        "GovernanceProcedure",
        lazy="joined",
    )
