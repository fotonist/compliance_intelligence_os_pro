from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Process(Base):
    __tablename__ = "processes"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    owner = Column(String(255), nullable=True)
    status = Column(String(50), default="draft")

    # ✅ Process ↔ Risk link (many-to-many via ProcessRiskLink)
    risk_links = relationship(
        "ProcessRiskLink",
        primaryjoin="Process.id==ProcessRiskLink.process_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
