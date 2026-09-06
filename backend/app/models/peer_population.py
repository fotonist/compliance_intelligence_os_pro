from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class PeerPopulation(Base):
    __tablename__ = "peer_populations"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    # Eligibility dimensions
    industry = Column(
        String(255),
        nullable=True,
        index=True,
    )

    geography = Column(
        String(255),
        nullable=True,
        index=True,
    )

    company_size_band = Column(
        String(100),
        nullable=True,
        index=True,
    )

    revenue_band = Column(
        String(100),
        nullable=True,
        index=True,
    )

    # Optional framework alignment
    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    minimum_sample_size = Column(
        Integer,
        nullable=False,
        default=5,
        server_default="5",
    )

    # DRAFT / CONFIGURING / ACTIVE / SUSPENDED / RETIRED
    status = Column(
        String(50),
        nullable=False,
        default="DRAFT",
        server_default="DRAFT",
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    approved_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PeerPopulationMember(Base):
    __tablename__ = "peer_population_members"

    id = Column(Integer, primary_key=True, index=True)

    population_id = Column(
        Integer,
        ForeignKey("peer_populations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # MANUAL / RULE_BASED / SYSTEM
    membership_type = Column(
        String(50),
        nullable=False,
        default="MANUAL",
        server_default="MANUAL",
    )

    # ELIGIBLE / INELIGIBLE / PENDING
    eligibility_status = Column(
        String(50),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
        index=True,
    )

    effective_from = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    effective_to = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
