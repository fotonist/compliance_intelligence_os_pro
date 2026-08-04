# C:\Projects\compliance_app\backend\app\models\risk_versions.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base


from app.models.mixins import TenantMixin

class RiskVersion(Base, TenantMixin):
    """
    Yeni immutable model.
    Migration sonrası Risk güncelleme akışı:
      - Risk değişince yeni RiskVersion INSERT edilir.
      - Audit snapshot risk_version_id ile sabitlenir.
    """
    __tablename__ = "risk_versions"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id", ondelete="CASCADE"), nullable=False, index=True)

    version_number = Column(Integer, nullable=False)

    impact = Column(Integer, nullable=False)
    likelihood = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)
    risk_level = Column(String, nullable=False)

    status = Column(String, nullable=False)
    treatment = Column(String, nullable=True)
    action = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", lazy="joined")
    risk = relationship("Risk", lazy="joined")
