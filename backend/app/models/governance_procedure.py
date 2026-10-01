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


class GovernanceProcedure(Base):

    __tablename__ = "governance_procedures"

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

    policy_id = Column(
        Integer,
        ForeignKey(
            "governance_policies.id",
        ),
        nullable=True,
    )

    procedure_code = Column(
        String,
        nullable=True,
    )

    title = Column(
        String,
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    owner_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    status = Column(
        String,
        nullable=False,
        default="draft",
        index=True,
    )

    version = Column(
        String,
        nullable=False,
        default="1.0",
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

    policy = relationship(
        "GovernancePolicy",
        lazy="joined",
    )

    owner = relationship(
        "User",
        foreign_keys=[owner_id],
        lazy="joined",
    )

    controls = relationship(
        "GovernanceProcedureControl",
        back_populates="procedure",
        cascade="all, delete-orphan",
    )

    documents = relationship(
        "GovernanceProcedureDocument",
        back_populates="procedure",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
