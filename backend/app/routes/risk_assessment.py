from fastapi import APIRouter

router = APIRouter(
    prefix="/risk-assessment",
    tags=["Risk Assessment"],
)


@router.get("/questions")
def get_risk_assessment_questions():
    return [
        {
            "id": 1,
            "dimension": "likelihood",
            "title": "What is the likelihood of the event occurring?",
            "description": "Likelihood of the risk occurring within the defined assessment period.",
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
            "description": "Extent to which existing controls reduce the likelihood of the risk occurring.",
            "choices": [
                {"key": "rare", "label": "Very Effective"},
                {"key": "unlikely", "label": "Effective"},
                {"key": "possible", "label": "Partially Effective"},
                {"key": "likely", "label": "Weak"},
                {"key": "almost_certain", "label": "Ineffective"},
            ],
        },
        {
            "id": 3,
            "dimension": "impact",
            "title": "What is the financial impact level?",
            "description": "Potential financial impact if the risk materializes.",
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
            "title": "What is the operational impact level?",
            "description": "Potential impact on business operations and continuity.",
            "choices": [
                {"key": "negligible", "label": "No Material Impact"},
                {"key": "minor", "label": "Short Disruption"},
                {"key": "moderate", "label": "Partial Disruption"},
                {"key": "major", "label": "Extended Disruption"},
                {"key": "catastrophic", "label": "Business Shutdown"},
            ],
        },
    ]
