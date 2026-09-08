from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import foreign, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class GovernanceCommitteeHistory(Base):
    __tablename__ = "governance_committee_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    committee_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    action = Column(
        String(100),
        nullable=False,
    )

    field_name = Column(
        String(100),
        nullable=True,
    )

    old_value = Column(
        Text,
        nullable=True,
    )

    new_value = Column(
        Text,
        nullable=True,
    )

    comment = Column(
        Text,
        nullable=True,
    )

    performed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "committee_id"],
            [
                "governance_committees.tenant_id",
                "governance_committees.id",
            ],
            name="fk_governance_committee_history_committee_tenant",
            ondelete="CASCADE",
        ),
    )

    tenant = relationship(
        "Tenant",
        foreign_keys=[tenant_id],
        lazy="joined",
        viewonly=True,
    )

    committee = relationship(
        "GovernanceCommittee",
        back_populates="history",
        foreign_keys=[committee_id],
        primaryjoin=(
            "and_("
            "GovernanceCommittee.id == foreign(GovernanceCommitteeHistory.committee_id), "
            "GovernanceCommittee.tenant_id == foreign(GovernanceCommitteeHistory.tenant_id)"
            ")"
        ),
        lazy="joined",
    )

    performer = relationship(
        "User",
        foreign_keys=[performed_by],
        lazy="joined",
    )
