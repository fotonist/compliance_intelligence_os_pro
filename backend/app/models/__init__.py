from app.db.base import Base

# --- Standards Hierarchy ---
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.compliance_obligation import ComplianceObligation
from app.models.controls import Control

# --- Standard Version ---
from .standard_versions import StandardVersion

# --- Actions / Audit ---
from app.models.actions import Action
from app.models.audit_log import AuditLog
from .audit_sessions import AuditSession
from .audit_plans import AuditPlan
from app.models.clause_weight_override import ClauseWeightOverride
from .audit_scope_entities import AuditScopeEntity
from .audit_evidence_snapshots import AuditEvidenceSnapshot
from .audit_risk_snapshots import AuditRiskSnapshot
from .audit_findings import AuditFinding

# --- Tenants ---
from .tenants import Tenant
from .compliance_tasks import ComplianceTask

# --- Process ---
from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink

# --- Evidence ---
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile
from app.models.evidence_history import EvidenceHistory

# --- Risk ---
from app.models.risks import Risk
from app.models.risk_history import RiskHistory
from .risk_versions import RiskVersion
from app.models.risk_evidence_link import RiskEvidenceLink

# --- Users / Roles ---
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole

# --- Premium License Requests ---
from app.models.premium_module_request import PremiumModuleRequest
from app.models.tenant_premium_module import TenantPremiumModule

# --- MATURITY / STANDARD ---
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_capability_level import StandardCapabilityLevel

# --- MATURITY ASSESSMENT ---
from app.models.maturity_assessment_session import MaturityAssessmentSession
from app.models.maturity_practice_evaluation import MaturityPracticeEvaluation
from app.models.practice_evidence_link import PracticeEvidenceLink

# --- Risk Appetite ---
from app.models.risk_appetite_profile import RiskAppetiteProfile
from app.models.process_risk_appetite import ProcessRiskAppetite

# --- Company Foundation ---
from app.models.company_objective import CompanyObjective
from app.models.asset import Asset
from app.models.organization import Organization
from app.models.stakeholder import Stakeholder
from app.models.location import Location
# --- Governance ---
from app.models.governance_policy import GovernancePolicy
from app.models.governance_procedure import GovernanceProcedure

from app.models.governance_procedure_document import GovernanceProcedureDocument
from app.models.governance_document_history import GovernanceDocumentHistory






# --- Decision Register ---
from app.models.decision_register import DecisionRegister
from app.models.decision_register_history import DecisionRegisterHistory
from app.models.decision_register_risk import DecisionRegisterRisk
from app.models.decision_register_control import DecisionRegisterControl
from app.models.decision_register_process import DecisionRegisterProcess
from app.models.decision_register_task import DecisionRegisterTask
