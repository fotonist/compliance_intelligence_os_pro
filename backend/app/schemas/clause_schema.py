from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

from .requirement_schema import Requirement


class ClauseBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    standard_id: int


class ClauseCreate(ClauseBase):
    """Yeni madde oluşturmak için kullanılan şema."""
    pass


class ClauseUpdate(BaseModel):
    """Güncelleme için kısmi alanlar."""
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    standard_id: Optional[int] = None


class ClauseInDBBase(ClauseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class Clause(ClauseInDBBase):
    """API tarafında dönen madde bilgisi."""

    # Clause → Requirement ilişkisi
    requirements: List[Requirement] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ClauseInDB(ClauseInDBBase):
    model_config = ConfigDict(from_attributes=True)