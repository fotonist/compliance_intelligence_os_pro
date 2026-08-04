from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.schemas.requirement_schema import RequirementCreate



class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True)
    clause_id = Column(Integer, ForeignKey("clauses.id"))
    code = Column(String, nullable=False)
    title = Column(String, nullable=False)

    # Clause ilişkisi
    clause = relationship("Clause", back_populates="requirements")

    # Control ilişkisi
    controls = relationship("Control", back_populates="requirement")

    # 🔥 EKLENEN DOĞRU İLİŞKİ
    # Evidence modelinde:
    # requirement = relationship("Requirement", back_populates="evidences")
    # olduğu için burası zorunludur.
    evidences = relationship("Evidence", back_populates="requirement")
