from sqlalchemy.orm import Session
from app.models.evidence_files import EvidenceFile


class EvidenceService:
    """
    =====================================================
    EVIDENCE SERVICE
    =====================================================

    This service is the single source of truth for all
    evidence-related business rules.

    Responsibilities:
    - Evidence file lifecycle handling
    - Evidence overall status calculation
    - Centralized logic shared by:
        * KPI endpoints
        * Dashboard
        * Evidence detail views
    """

    # =====================================================
    # EVIDENCE OVERALL STATUS CALCULATION
    #
    # Returns ONE of the following high-level statuses:
    #
    # - completed
    # - in_progress
    # - not_completed
    #
    # Rules (FINAL – agreed logic):
    #
    # 1) If there are NO files
    #    → not_completed
    #
    # 2) If there is AT LEAST ONE rejected file
    #    → not_completed
    #
    # 3) If ALL files are approved
    #    → completed
    #
    # 4) If there is NO rejected file
    #    AND at least one waiting_approval file
    #    → in_progress
    #
    # 5) Any remaining case
    #    → not_completed
    #
    # Notes:
    # - "rejected" is NOT a top-level status anymore
    # - File-level statuses are NOT exposed to dashboards
    # - This function is used by KPI, dashboard and UI
    # =====================================================
    @staticmethod
    def calculate_overall_status(
        db: Session,
        evidence_id: int,
        fallback: str = "not_completed",
    ) -> str:
        files = (
            db.query(EvidenceFile.status)
            .filter(EvidenceFile.evidence_id == evidence_id)
            .all()
        )

        # 1) No files at all
        if not files:
            return fallback

        statuses = [f.status.lower().strip() for f in files]

        # 2) Any rejected file
        if "rejected" in statuses:
            return "not_completed"

        # 3) All approved
        if all(s == "approved" for s in statuses):
            return "completed"

        # 4) Waiting approval exists (no rejected)
        if "waiting_approval" in statuses:
            return "in_progress"

        # 5) Default fallback
        return "not_completed"
