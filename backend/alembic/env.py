from __future__ import with_statement

from alembic import context
from sqlalchemy import engine_from_config, pool
from logging.config import fileConfig
from dotenv import load_dotenv
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", ".env")
    )
)

config = context.config
fileConfig(config.config_file_name)

from app.db.base import Base

# --- Core / Tenancy ---
from app.models.tenants import Tenant
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole

# --- Standards Hierarchy ---
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control

# --- Risk ---
from app.models.risks import Risk
from app.models.risk_history import RiskHistory
from app.models.risk_versions import RiskVersion
from app.models.risk_evidence_link import RiskEvidenceLink

# --- Process ---
from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink

# --- Evidence ---
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile

# --- Audit ---
from app.models.audit_sessions import AuditSession
from app.models.audit_scope_entities import AuditScopeEntity
from app.models.audit_evidence_snapshots import AuditEvidenceSnapshot
from app.models.audit_risk_snapshots import AuditRiskSnapshot
from app.models.audit_findings import AuditFinding
from app.models.audit_log import AuditLog

# --- Actions ---
from app.models.actions import Action

# --- Maturity ---
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_capability_level import StandardCapabilityLevel
from app.models.maturity_assessment_session import MaturityAssessmentSession
from app.models.maturity_practice_evaluation import MaturityPracticeEvaluation
from app.models.practice_evidence_link import PracticeEvidenceLink
from app.models.maturity_workspace_sessions import MaturityWorkspaceSession

# --- Compliance Engine ---
from app.models.compliance_tasks import ComplianceTask

target_metadata = Base.metadata


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not defined in backend/.env"
        )

    return database_url.strip()


def run_migrations_offline():
    url = get_database_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    database_url = get_database_url()

    configuration = config.get_section(
        config.config_ini_section
    )

    configuration["sqlalchemy.url"] = database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

# --- Company Foundation ---
from app.models.company_objective import CompanyObjective

# --- Framework Adoption ---
from app.models.framework_adoption import FrameworkAdoption, FrameworkAdoptionScope
