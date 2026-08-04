from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# -------------------------------------------------
# MODEL REGISTRY (TEK VE ZORUNLU NOKTA)
# -------------------------------------------------

# --- Actions / Audit ---
from app.models.actions import Action
from app.models.audit_log import AuditLog

# --- Users / Roles ---
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole

# --- Standards Hierarchy ---
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control

# --- Maturity / Standard ---
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_capability_level import StandardCapabilityLevel
from app.models.standard_practice import StandardPractice

# --- Evidence ---
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile
from app.models.practice_evidence_link import PracticeEvidenceLink

# --- Risk ---
from app.models.risks import Risk
from app.models.risk_history import RiskHistory
from app.models.risk_evidence_link import RiskEvidenceLink

# --- Maturity Assessment ---
from app.models.maturity_assessment_session import MaturityAssessmentSession
from app.models.maturity_practice_evaluation import MaturityPracticeEvaluation
