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


class Stakeholder(Base):

    __tablename__ = "stakeholders"

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

    organization_id = Column(
        Integer,
        ForeignKey(
            "organizations.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    name = Column(
        String,
        nullable=True,
    )

    stakeholder_type = Column(
        String,
        nullable=True,
    )

    relationship = Column(
        String,
        nullable=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    contact_person = Column(
        String,
        nullable=True,
    )

    email = Column(
        String,
        nullable=True,
    )

    phone = Column(
        String,
        nullable=True,
    )

    importance = Column(
        String,
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
