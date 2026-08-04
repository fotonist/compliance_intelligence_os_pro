from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

from .controls_schema import Control


class RequirementBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    clause_id: int


class RequirementCreate(RequirementBase):
    """Yeni requirement için şema."""
    pass


class RequirementUpdate(BaseModel):
    """Güncelleme şeması (kısmi alanlara izin verilir)."""
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    clause_id: Optional[int] = None


class RequirementInDBBase(RequirementBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class Requirement(RequirementInDBBase):
    """API tarafında dönen requirement modeli."""

    # Requirement → Control ilişkisi (1:N)
    controls: List[Control] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RequirementInDB(RequirementInDBBase):
    """Internal DB modeli."""
    model_config = ConfigDict(from_attributes=True)