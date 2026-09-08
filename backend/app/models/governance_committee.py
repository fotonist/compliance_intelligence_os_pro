from sqlalchemy import (
    Boolean,
    Column,
    Date,
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


class GovernanceCommittee(Base):
    __tablename__ = "governance_committees"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    committee_code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    name = Column(
        String(500),
        nullable=False,
    )

    committee_type = Column(
        String(100),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    chairperson_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    secretary_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
        index=True,
    )

    meeting_cadence = Column(
        String(100),
        nullable=True,
    )

    effective_date = Column(
        Date,
        nullable=True,
    )

    review_date = Column(
        Date,
        nullable=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tenant = relationship(
        "Tenant",
        lazy="joined",
    )

    chairperson = relationship(
        "User",
        foreign_keys=[chairperson_id],
        lazy="joined",
    )

    secretary = relationship(
        "User",
        foreign_keys=[secretary_id],
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

    members = relationship(
        "GovernanceCommitteeMember",
        back_populates="committee",
        cascade="all, delete-orphan",
        foreign_keys="GovernanceCommitteeMember.committee_id",
    )

    meetings = relationship(
        "GovernanceMeeting",
        back_populates="committee",
    )

    history = relationship(
        "GovernanceCommitteeHistory",
        back_populates="committee",
        cascade="all, delete-orphan",
        order_by="GovernanceCommitteeHistory.created_at.desc()",
        foreign_keys="GovernanceCommitteeHistory.committee_id",
    )


class GovernanceCommitteeMember(Base):
    __tablename__ = "governance_committee_members"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    committee_id = Column(
        Integer,
        nullable=False,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    member_role = Column(
        String(100),
        nullable=False,
        default="MEMBER",
        server_default="MEMBER",
    )

    is_voting_member = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    start_date = Column(
        Date,
        nullable=True,
    )

    end_date = Column(
        Date,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "committee_id"],
            [
                "governance_committees.tenant_id",
                "governance_committees.id",
            ],
            name="fk_governance_committee_members_committee_tenant",
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
        back_populates="members",
        foreign_keys=[committee_id],
        primaryjoin=(
            "and_("
            "GovernanceCommittee.id == foreign(GovernanceCommitteeMember.committee_id), "
            "GovernanceCommittee.tenant_id == foreign(GovernanceCommitteeMember.tenant_id)"
            ")"
        ),
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="joined",
    )
