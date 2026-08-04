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
            "title": "Olayın gerçekleşme olasılığı nedir?",
            "description": "Riskin belirli bir zaman diliminde gerçekleşme ihtimali",
            "choices": [
                {"key": "rare", "label": "Çok düşük"},
                {"key": "unlikely", "label": "Düşük"},
                {"key": "possible", "label": "Olası"},
                {"key": "likely", "label": "Yüksek"},
                {"key": "almost_certain", "label": "Çok yüksek"},
            ],
        },
        {
            "id": 2,
            "dimension": "likelihood",
            "title": "Mevcut kontrollerin etkinliği nedir?",
            "description": "Kontroller riski ne ölçüde azaltıyor?",
            "choices": [
                {"key": "rare", "label": "Çok etkili"},
                {"key": "unlikely", "label": "Etkili"},
                {"key": "possible", "label": "Kısmen"},
                {"key": "likely", "label": "Zayıf"},
                {"key": "almost_certain", "label": "Etkisiz"},
            ],
        },

        # ===== Impact =====
        {
            "id": 3,
            "dimension": "impact",
            "title": "Finansal etki seviyesi nedir?",
            "description": "Risk gerçekleşirse finansal etkisi",
            "choices": [
                {"key": "negligible", "label": "İhmal edilebilir"},
                {"key": "minor", "label": "Düşük"},
                {"key": "moderate", "label": "Orta"},
                {"key": "major", "label": "Yüksek"},
                {"key": "catastrophic", "label": "Kritik"},
            ],
        },
        {
            "id": 4,
            "dimension": "impact",
            "title": "Operasyonel etki seviyesi nedir?",
            "description": "İş sürekliliğine etkisi",
            "choices": [
                {"key": "negligible", "label": "Etkisiz"},
                {"key": "minor", "label": "Kısa aksama"},
                {"key": "moderate", "label": "Kısmi kesinti"},
                {"key": "major", "label": "Uzun kesinti"},
                {"key": "catastrophic", "label": "İş durması"},
            ],
        },
    ]
