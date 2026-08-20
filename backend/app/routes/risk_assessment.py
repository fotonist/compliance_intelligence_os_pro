from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(
    prefix="/risk-assessment",
    tags=["Risk Assessment"],
)


@router.get("/questions")
def get_risk_assessment_questions(db: Session = Depends(get_db)):
    return [
        # ===== Likelihood =====
        {
            "id": 1,
            "dimension": "likelihood",
            "title": "What is the likelihood of the event occurring?",
            "description": "The probability that the risk will occur within a defined time period",
            "choices": [
                {"key": "rare", "label": "Rare"},
                {"key": "unlikely", "label": "Unlikely"},
                {"key": "possible", "label": "Possible"},
                {"key": "likely", "label": "Likely"},
                {"key": "almost_certain", "label": "Almost Certain"},
            ],
        },
        {
            "id": 2,
            "dimension": "likelihood",
            "title": "How effective are the existing controls?",
            "description": "The extent to which existing controls reduce the risk",
            "choices": [
                {"key": "rare", "label": "Highly Effective"},
                {"key": "unlikely", "label": "Effective"},
                {"key": "possible", "label": "Partially Effective"},
                {"key": "likely", "label": "Weak"},
                {"key": "almost_certain", "label": "Ineffective"},
            ],
        },

        # ===== Impact =====
        {
            "id": 3,
            "dimension": "impact",
            "title": "What is the level of financial impact?",
            "description": "The potential financial impact if the risk occurs",
            "choices": [
                {"key": "negligible", "label": "Negligible"},
                {"key": "minor", "label": "Minor"},
                {"key": "moderate", "label": "Moderate"},
                {"key": "major", "label": "Major"},
                {"key": "catastrophic", "label": "Critical"},
            ],
        },
        {
            "id": 4,
            "dimension": "impact",
            "title": "What is the level of operational impact?",
            "description": "The potential impact on business continuity",
            "choices": [
                {"key": "negligible", "label": "No Impact"},
                {"key": "minor", "label": "Short Disruption"},
                {"key": "moderate", "label": "Partial Disruption"},
                {"key": "major", "label": "Extended Disruption"},
                {"key": "catastrophic", "label": "Business Stoppage"},
            ],
        },
    ]
