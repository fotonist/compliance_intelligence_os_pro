from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base

from app.models.mixins import TenantMixin


class RiskHistory(Base, TenantMixin):
    """
    DB schema (existing):
      - impact_old / impact_new
      - likelihood_old / likelihood_new
      - score_old / score_new
      - risk_level_old / risk_level_new
      - treatment_old / treatment_new
      - status_old / status_new
      - action_old / action_new
      - changed_by
      - changed_at
      - tenant_id
    """

    __tablename__ = "risk_history"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ MULTI-TENANT
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    risk_id = Column(
        Integer,
        ForeignKey("risks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Score/Impact/Likelihood (DB naming) ---
    impact_old = Column(Integer, nullable=True)
    impact_new = Column(Integer, nullable=True)

    likelihood_old = Column(Integer, nullable=True)
    likelihood_new = Column(Integer, nullable=True)

    score_old = Column(Integer, nullable=True)
    score_new = Column(Integer, nullable=True)

    # --- Optional fields present in DB ---
    risk_level_old = Column(String, nullable=True)
    risk_level_new = Column(String, nullable=True)

    treatment_old = Column(String, nullable=True)
    treatment_new = Column(String, nullable=True)

    status_old = Column(String, nullable=True)
    status_new = Column(String, nullable=True)

    action_old = Column(String, nullable=True)
    action_new = Column(String, nullable=True)

    changed_by = Column(Integer, nullable=True)

    # DB uses changed_at instead of created_at
    changed_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    # 🔥 Risk modeline bağlanan ilişki
    risk = relationship("Risk", back_populates="history")

    # -------------------------------------------------
    # Compatibility properties (engine/legacy code)
    # -------------------------------------------------
    @property
    def created_at(self):
        # some code expects created_at
        return self.changed_at

    @property
    def old_impact(self):
        return self.impact_old

    @property
    def new_impact(self):
        return self.impact_new

    @property
    def old_likelihood(self):
        return self.likelihood_old

    @property
    def new_likelihood(self):
        return self.likelihood_new

    @property
    def old_score(self):
        return self.score_old

    @property
    def new_score(self):
        return self.score_new

    @property
    def treatment(self):
        # keep old attribute access (best-effort)
        return self.treatment_new

    @property
    def status(self):
        return self.status_new