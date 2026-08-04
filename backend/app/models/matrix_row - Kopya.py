from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class MatrixRow(Base):
    __tablename__ = "matrix_rows"

    id = Column(Integer, primary_key=True)

    # 🔴 KRİTİK: Instance bağlantısı
    instance_id = Column(
        Integer,
        ForeignKey("matrix_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    standard_id = Column(
        Integer,
        ForeignKey("standards.id"),
        nullable=False,
    )

    clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=True)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=True)

    process_area_id = Column(
        Integer,
        ForeignKey("standard_process_areas.id"),
        nullable=True,
    )

    practice_id = Column(
        Integer,
        ForeignKey("standard_practices.id"),
        nullable=True,
    )

    mode = Column(String(20), nullable=False)
    row_key = Column(String, nullable=False)
    payload = Column(JSONB, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
