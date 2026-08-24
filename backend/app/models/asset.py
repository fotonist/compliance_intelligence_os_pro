from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    func,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class Asset(Base):

    __tablename__ = "assets"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    code = Column(
        String(50),
        nullable=False,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
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

    asset_type = Column(
        String(20),
        nullable=False,
        default="other",
        server_default="other",
        index=True,
    )

    criticality = Column(
        String(20),
        nullable=False,
        default="medium",
        server_default="medium",
    )

    status = Column(
        String(30),
        nullable=False,
        default="active",
        server_default="active",
    )

    lifecycle_status = Column(
        String(30),
        nullable=False,
        default="in_service",
        server_default="in_service",
    )

    information_classification = Column(
        String(50),
        nullable=True,
    )

    owner_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    custodian_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    owner_user = relationship(
        "User",
        foreign_keys=[owner_user_id],
    )

    custodian_user = relationship(
        "User",
        foreign_keys=[custodian_user_id],
    )

    department = Column(
        String,
        nullable=True,
    )

    location = Column(
        String,
        nullable=True,
    )

    manufacturer = Column(
        String,
        nullable=True,
    )

    model_number = Column(
        String,
        nullable=True,
    )

    serial_number = Column(
        String,
        nullable=True,
    )

    acquisition_date = Column(
        DateTime,
        nullable=True,
    )

    warranty_expiry = Column(
        DateTime,
        nullable=True,
    )

    contract_expiry = Column(
        DateTime,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
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