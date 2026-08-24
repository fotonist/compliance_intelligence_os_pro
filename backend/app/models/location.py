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


class Location(Base):

    __tablename__ = "locations"

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

    code = Column(
        String,
        nullable=True,
    )

    location_type = Column(
        String,
        nullable=True,
    )

    address = Column(
        Text,
        nullable=True,
    )

    city = Column(
        String,
        nullable=True,
    )

    country = Column(
        String,
        nullable=True,
    )

    contact_person = Column(
        String,
        nullable=True,
    )

    contact_email = Column(
        String,
        nullable=True,
    )

    contact_phone = Column(
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
