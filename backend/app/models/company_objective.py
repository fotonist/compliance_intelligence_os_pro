from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Numeric,
    func,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class CompanyObjective(Base):

    __tablename__ = "company_objectives"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    code = Column(
        String(50),
        nullable=False,
    )

    title = Column(
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

    objective_type = Column(
        String(20),
        nullable=False,
        default="strategic",
        server_default="strategic",
    )

    priority = Column(
        String(30),
        nullable=False,
        default="medium",
        server_default="medium",
    )

    status = Column(
        String(20),
        nullable=False,
        default="draft",
        server_default="draft",
    )

    owner_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    owner_user = relationship(
        "User",
    )

    target_date = Column(
        DateTime,
        nullable=True,
    )

    measurement_method = Column(
        String,
        nullable=True,
    )

    target_value = Column(
        Numeric(18, 4),
        nullable=True,
    )

    current_value = Column(
        Numeric(18, 4),
        nullable=True,
    )

    unit = Column(
        String,
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