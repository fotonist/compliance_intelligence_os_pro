from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

from .evidence_schema import Evidence


class ControlBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    requirement_id: int


class ControlCreate(ControlBase):
    """Yeni control oluştururken kullanılan şema."""
    pass


class ControlUpdate(BaseModel):
    """Kısmi güncellemeye izin veren şema."""
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    requirement_id: Optional[int] = None


class ControlInDBBase(ControlBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class Control(ControlInDBBase):
    """API’nin döneceği kontrol modeli."""

    # Control → Evidence ilişkisi
    evidences: List[Evidence] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ControlInDB(ControlInDBBase):
    model_config = ConfigDict(from_attributes=True)