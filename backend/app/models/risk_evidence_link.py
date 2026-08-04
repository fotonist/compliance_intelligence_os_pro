from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.risk_versions import RiskVersion


class RiskEvidenceLink(Base):
    __tablename__ = "risk_evidence_link"

    id = Column(Integer, primary_key=True, index=True)

    # MULTI TENANT
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # RISK VERSION
    risk_version_id = Column(
        Integer,
        ForeignKey("risk_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ✅ SADECE FILE ÜZERİNDEN İLERLİYORUZ
    evidence_file_id = Column(
        Integer,
        ForeignKey("evidence_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # RELATIONS
    tenant = relationship("Tenant", lazy="joined")
    risk_version = relationship(RiskVersion, lazy="joined")

    # ✅ DOĞRU İLİŞKİ
    evidence_file = relationship("EvidenceFile", lazy="joined")

    # ❌ TAMAMEN SİLİNDİ
    # evidence_id
    # evidence relationship