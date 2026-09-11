from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ProcessPamMapping(Base):
    __tablename__ = "process_pam_mappings"
    __table_args__ = (
        UniqueConstraint(
            "process_id",
            "pam_process_id",
            name="uq_process_pam_mapping",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pam_process_id = Column(
        Integer,
        ForeignKey("pam_processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mapping_type = Column(String(30), nullable=False, default="PRIMARY")
    confidence = Column(Float, nullable=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    process = relationship("Process", back_populates="pam_mappings")
    pam_process = relationship("PamProcess")
