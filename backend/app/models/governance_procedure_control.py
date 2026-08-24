from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class GovernanceProcedureControl(Base):

    __tablename__ = "governance_procedure_controls"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
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

    procedure_id = Column(
        Integer,
        ForeignKey(
            "governance_procedures.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    control_id = Column(
        Integer,
        ForeignKey(
            "controls.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    procedure = relationship(
        "GovernanceProcedure",
        back_populates="controls",
    )

    control = relationship(
        "Control",
    )
