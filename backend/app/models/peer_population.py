from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base import Base


class PeerPopulation(Base):
    __tablename__ = "peer_populations"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            name="uq_peer_populations_tenant_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    population_key = Column(String(128), nullable=False, index=True)
    industry = Column(String(128), nullable=True)
    company_size = Column(String(64), nullable=True)
    region = Column(String(64), nullable=True)

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
