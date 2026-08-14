import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import engine, SessionLocal
from app.db.base import Base
from app.api.compliance_object import router as compliance_object_router
# ==============================
# ROUTER IMPORTS
# ==============================
from app.routes.user import router as user_router
from app.routes.roles import router as roles_router
from app.api import auth, assessments
from app.api.executive_summary import router as executive_summary_router
from app.routes.matrix import router as matrix_router
from app.routes.risk import router as risk_router
from app.routes.risk_create import router as risk_create_router
from app.routes.evidence import router as evidence_router
from app.routes.evidence_files import router as evidence_files_router
from app.routes.standards import router as standards_router
from app.routes.controls import router as controls_router
from app.routes.risk_assessment import router as risk_assessment_router
from app.routes.ai import router as ai_router
from app.routes.kpi import router as kpi_router
from app.routes.maturity import router as maturity_router
from app.routes.standard_maturity_structure import router as standard_maturity_structure_router
from app.routes.control_assessments import router as control_assessments_router
from app.routes.requirements import router as requirements_router
from app.routes.risk_intelligence import router as risk_intelligence_router
from app.routes.company import router as company_router
from app.routes.processes import router as processes_router
from app.routes.process_risk_links import router as process_risk_router
from app.routes.coverage import router as coverage_router
from app.routes import readiness
from app.routes import clause_weights
from app.routes.clauses import router as clause_router
from app.routes import heatmap
from app.routes import standard_structure
from app.routes.intelligence_health import router as intelligence_health_router
from app.routes.intelligence import router as intelligence_router
from app.routes.risk_forecast import router as risk_forecast_router
from app.routes.intelligence_control import router as intelligence_control_router
from app.routes.uee import router as uee_router
from app.routes.analytics import router as analytics_router
from app.routes.process_readiness import router as process_readiness_router
from app.routes.license import router as license_router
from app.routes.analytics_control import router as analytics_control_router
from app.routes.company_tasks_evidence import router as company_tasks_evidence_router
from app.routes.company_tasks import router as company_tasks_router
from app.routes.intelligence import api_router as intelligence_api_router
from app.models.maturity_workspace_sessions import MaturityWorkspaceSession
from app.api.risk_appetite import router as risk_appetite_router

# ==============================
# MODELS (metadata load safety)
# ==============================

import app.models.user
import app.models.role
import app.models.risks
import app.models.evidences
import app.models.standards
import app.models.controls
import app.models.risk_assessment
import app.models.scoring_config
import app.models.maturity_assessment_session
import app.models.maturity_practice_evaluation
import app.models.practice_evidence_link
import app.models.maturity_evidence
import app.models.maturity_evidence_file
import app.models.process
import app.models.process_risk_link
import app.models.clause_weight_override

# ==============================
# SEED
# ==============================

from app.seed.risk_assessment_seed import seed_risk_assessment_questions
from app.seed.iso15504_2006 import seed_iso15504_2006

# ==============================
# APP INIT
# ==============================

app = FastAPI()

# ==============================
# CORS
# ==============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://compliance-intelligence-os-m65n.vercel.app",
        "https://compliance-intelligence-os-pro-u6yj-r5twwl9gv.vercel.app",
        "https://compliance-intelligence-os-d3ot6ocmd-hasans-projects-b02466bd.vercel.app",
    ],
    allow_origin_regex=r"^https://compliance-intelligence-os(?:-pro)?(?:-[a-z0-9-]+)?\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_ROOT = "uploads"
if not os.path.exists(UPLOAD_ROOT):
    os.makedirs(UPLOAD_ROOT)
app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        seed_risk_assessment_questions(db)
        seed_iso15504_2006(db)
    finally:
        db.close()

# ==============================
# ROUTER INCLUDES
# ==============================

app.include_router(auth.router, tags=["auth"])
app.include_router(matrix_router)
app.include_router(assessments.router)
app.include_router(kpi_router)
app.include_router(control_assessments_router)
app.include_router(evidence_files_router)
app.include_router(user_router)

# Schema-safe task evidence routes MUST precede the legacy task router.
app.include_router(company_tasks_evidence_router)
app.include_router(company_tasks_router)

app.include_router(evidence_router)
app.include_router(evidence_router, prefix="/company")
app.include_router(risk_create_router)
app.include_router(risk_router)
app.include_router(standards_router)
app.include_router(standard_structure.router)
app.include_router(controls_router)
app.include_router(ai_router)
app.include_router(risk_assessment_router)
app.include_router(requirements_router)
app.include_router(risk_intelligence_router)
app.include_router(company_router)
app.include_router(processes_router)
app.include_router(process_risk_router)
app.include_router(coverage_router)
app.include_router(readiness.router)
app.include_router(clause_weights.router)
app.include_router(heatmap.router)

# Intelligence health endpoints precede legacy intelligence routes.
app.include_router(intelligence_health_router)
app.include_router(executive_summary_router)
app.include_router(intelligence_router)
app.include_router(intelligence_api_router)
app.include_router(risk_forecast_router)
app.include_router(intelligence_control_router)
app.include_router(uee_router)
app.include_router(process_readiness_router)
app.include_router(analytics_router)
app.include_router(analytics_control_router)
app.include_router(roles_router)
app.include_router(maturity_router)
app.include_router(clause_router)
app.include_router(risk_appetite_router)
app.include_router(compliance_object_router)
app.include_router(license_router)

@app.get("/")
def health():
    return {"status": "ok"}

@app.get("/health/intelligence")
def intelligence_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "active", "engine": "intelligence"}
    except Exception:
        return {"status": "offline", "engine": "intelligence"}
