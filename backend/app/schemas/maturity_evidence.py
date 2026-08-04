from typing import Optional

from pydantic import BaseModel


class MaturityEvidenceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    practice_evaluation_id: int