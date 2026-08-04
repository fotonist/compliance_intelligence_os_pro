from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.maturity_assessment_session import MaturityAssessmentSession
from app.models.standard_process_area import StandardProcessArea
from app.models.maturity_practice import MaturityPractice
from app.models.practice_assessment import PracticeAssessment


def get_maturity_structure(db: Session, session_id: int):
    session = (
        db.query(MaturityAssessmentSession)
        .filter(MaturityAssessmentSession.id == session_id)
        .first()
    )

    if not session:
        return None

    process_areas = (
        db.query(StandardProcessArea)
        .filter(StandardProcessArea.standard_id == session.standard_id)
        .order_by(StandardProcessArea.sort_order)
        .all()
    )

    result_areas = []

    for pa in process_areas:
        total_practices = (
            db.query(MaturityPractice)
            .filter(MaturityPractice.process_area_id == pa.id)
            .count()
        )

        assessed_practices = (
            db.query(PracticeAssessment)
            .join(MaturityPractice)
            .filter(
                PracticeAssessment.session_id == session_id,
                MaturityPractice.process_area_id == pa.id,
            )
            .count()
        )

        # Status hesaplama (GERÇEK)
        if assessed_practices == 0:
            status = "NOT_STARTED"
        elif assessed_practices < total_practices:
            status = "IN_PROGRESS"
        else:
            status = "COMPLETED"

        # Maturity level (örnek: max achieved level)
        maturity_level = (
            db.query(func.max(PracticeAssessment.maturity_level))
            .join(MaturityPractice)
            .filter(
                PracticeAssessment.session_id == session_id,
                MaturityPractice.process_area_id == pa.id,
            )
            .scalar()
        )

        result_areas.append(
            {
                "id": pa.id,
                "code": pa.code,
                "title": pa.title,
                "total_practices": total_practices,
                "assessed_practices": assessed_practices,
                "status": status,
                "maturity_level": maturity_level,
            }
        )

    return {
        "session_id": session.id,
        "standard": {
            "id": session.standard_id,
            "code": session.standard.code if session.standard else None,
        },
        "scope": session.scope,
        "status": session.status,
        "overall_level": session.overall_level,
        "process_areas": result_areas,
    }
