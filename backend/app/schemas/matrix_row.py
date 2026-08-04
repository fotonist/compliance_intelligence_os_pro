from typing import Optional

from pydantic import BaseModel, ConfigDict


class MatrixRowResponse(BaseModel):
    # -----------------------------
    # STANDARD
    # -----------------------------
    standard_code: str
    standard_title: str

    # -----------------------------
    # CLAUSE
    # -----------------------------
    clause_code: str
    clause_title: str

    # -----------------------------
    # REQUIREMENT
    # -----------------------------
    requirement_code: str
    requirement_title: str

    # -----------------------------
    # CONTROL
    # -----------------------------
    control_id: int
    control_code: str
    control_title: str
    control_description: Optional[str] = None

    # -----------------------------
    # EVIDENCE (LOGICAL)
    # -----------------------------
    evidence_id: Optional[int] = None
    evidence_title: Optional[str] = None

    # Possible values:
    # NO_EVIDENCE | NO_FILE | SUBMITTED | APPROVED | REJECTED | IN_REVIEW
    evidence_status: str

    # -----------------------------
    # COVERAGE (REQUIREMENT LEVEL)
    # -----------------------------
    coverage_pct: int

    model_config = ConfigDict(from_attributes=True)