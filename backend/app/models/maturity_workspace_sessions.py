from sqlalchemy import (
    Column,
    Integer,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.db.base import Base


class MaturityWorkspaceSession(Base):
    __tablename__ = "maturity_workspace_sessions"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    process_area_id = Column(
        Integer,
        ForeignKey("standard_process_areas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name = Column(
        String(255),
        nullable=True,
    )

    scope = Column(
        Text,
        nullable=True,
    )

    status = Column(
        String(30),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=True,
    )