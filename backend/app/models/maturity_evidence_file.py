from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.db.base import Base


class MaturityEvidenceFile(Base):
    __tablename__ = "maturity_evidence_files"

    id = Column(Integer, primary_key=True, index=True)

    evidence_id = Column(
        Integer,
        ForeignKey("maturity_evidences.id", ondelete="CASCADE"),
        nullable=False,
    )

    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)

    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)

    uploaded_by = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
