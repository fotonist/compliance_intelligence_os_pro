from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AssessmentStatus = Literal["draft", "completed", "cancelled"]
QuestionCategory = Literal["likelihood", "impact"]
AnswerValue = Literal["yes", "no", "partial", "na"]


class RiskAssessmentSessionOut(BaseModel):
    id: UUID
    status: AssessmentStatus
    started_at: datetime
    completed_at: datetime | None = None

    calculated_likelihood: int | None = None
    calculated_impact: int | None = None
    calculated_risk_level: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AssessmentQuestionOut(BaseModel):
    id: int
    code: str
    category: QuestionCategory
    text: str
    weight: int

    model_config = ConfigDict(from_attributes=True)


class AssessmentAnswerIn(BaseModel):
    question_id: int
    answer: AnswerValue


class EvaluationResultOut(BaseModel):
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    risk_level: str