from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)

from app.db.base import Base


class Organization(Base):

    __tablename__ = "organizations"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    name = Column(
        String,
        nullable=True,
    )

    legal_name = Column(
        String,
        nullable=True,
    )

    industry = Column(
        String,
        nullable=True,
    )

    company_size = Column(
        String,
        nullable=True,
    )

    employee_count = Column(
        Integer,
        nullable=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    mission = Column(
        Text,
        nullable=True,
    )

    vision = Column(
        Text,
        nullable=True,
    )

    scope_statement = Column(
        Text,
        nullable=True,
    )

    status = Column(
        String,
        nullable=False,
        default="ACTIVE",
    )

    created_by = Column(
        Integer,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=True,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=True,
    )
