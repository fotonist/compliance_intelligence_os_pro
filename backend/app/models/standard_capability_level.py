from sqlalchemy import Column, Integer, String, Text, ForeignKey, SmallInteger
from sqlalchemy.orm import relationship
from app.db.base import Base


class StandardCapabilityLevel(Base):
    __tablename__ = "standard_capability_levels"

    id = Column(Integer, primary_key=True)
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)

    level = Column(SmallInteger, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)

    standard = relationship("Standard", back_populates="capability_levels")
