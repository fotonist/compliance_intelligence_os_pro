import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from app.routes import kpi

# ==============================
# DB / BASE
# ==============================
from app.core.database import engine, SessionLocal
from app.db.base import Base

# ==============================
# MODELS (IMPORT ONLY)
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

# ==============================
# API ROUTERS
# ==============================
from app.api import auth, matrix, assessments
from app.routes import (
    risk,
    evidence,
    evidence_files,
    standards,
    controls,
    risk_assessment,
    maturity,                     # ✅ EKLENDİ
    standard_maturity_structure,  # ✅ EKLENDİ
)

# ==============================
# SEED
# ==============================
from app.seed.risk_assessment_seed import seed_risk_assessment_questions

# ==============================
# APP INIT
# ==============================
app = FastAPI()

# ==============================
# CORS
# ==============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# STARTUP
# ==============================
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        seed_risk_assessment_questions(db)
    finally:
        db.close()

# ==============================
# ROUTERS
# ==============================
app.include_router(auth.router, tags=["auth"])
app.include_router(matrix.router, tags=["matrix"])
app.include_router(assessments.router, tags=["assessments"])
app.include_router(controls.router)
app.include_router(kpi.router)

# 🔑 MATURITY (WORKSPACE / PRACTICES BURADAN GELİR)
app.include_router(maturity.router, tags=["maturity"])

# 🔑 MATURITY STRUCTURE (AYRI PREFIX – ÇAKIŞMA YOK)
app.include_router(
    standard_maturity_structure.router,
    prefix="/maturity/structure",
    tags=["maturity_structure"],
)

# 🔑 KRİTİK SIRA — ÖNCE FILES
app.include_router(evidence_files.router)

# 🔑 SONRA EVIDENCE
app.include_router(evidence.router, tags=["evidences"])

app.include_router(risk.router, tags=["risks"])
app.include_router(standards.router, prefix="/standards", tags=["standards"])
app.include_router(controls.router, tags=["controls"])

# AI ROUTER
from app.routes import ai
app.include_router(ai.router)

# 🔥 RISK ASSESSMENT
app.include_router(risk_assessment.router, tags=["risk_assessment"])

# ==============================
# HEALTH CHECK
# ==============================
@app.get("/")
def health():
    return {"status": "ok"}
