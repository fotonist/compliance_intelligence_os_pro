from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    func,
)

from sqlalchemy.orm import relationship

from app.db.base import Base


class GovernanceProcedureDocument(Base):

    __tablename__ = "governance_procedure_documents"

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
    )

    version = Column(
        String(50),
        nullable=False,
    )

    file_name = Column(
        String(255),
        nullable=True,
    )

    storage_key = Column(
        String(1000),
        nullable=True,
    )

    mime_type = Column(
        String(128),
        nullable=True,
    )

    file_size = Column(
        Integer,
        nullable=True,
    )

    checksum = Column(
        String,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="uploaded",
        index=True,
    )

    is_current = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_archived = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    uploaded_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    uploaded_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    archived_at = Column(
        DateTime,
        nullable=True,
    )

    reviewer_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    reviewed_at = Column(
        DateTime,
        nullable=True,
    )

    approved_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    approved_at = Column(
        DateTime,
        nullable=True,
    )

    rejected_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    rejected_at = Column(
        DateTime,
        nullable=True,
    )

    review_comment = Column(
        String(2000),
        nullable=True,
    )

    tenant = relationship(
        "Tenant",
        lazy="joined",
    )

    procedure = relationship(
        "GovernanceProcedure",
        back_populates="documents",
        lazy="selectin",
    )

    uploader = relationship(
        "User",
        foreign_keys=[uploaded_by],
        lazy="joined",
    )

    reviewer = relationship(
        "User",
        foreign_keys=[reviewer_id],
        lazy="joined",
    )

    approver = relationship(
        "User",
        foreign_keys=[approved_by],
        lazy="joined",
    )

    rejector = relationship(
        "User",
        foreign_keys=[rejected_by],
        lazy="joined",
    )
