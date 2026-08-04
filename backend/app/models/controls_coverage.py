from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


class ControlsCoverage(Base):
    __tablename__ = "controls_coverage"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(Integer, nullable=False, unique=True)
    evidence_count = Column(Integer)
    coverage_status = Column(String)
    updated_at = Column(DateTime)