from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

from .evidence_schema import Evidence


class ControlBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    requirement_id: Optional[int] = None


class ControlCreate(ControlBase):
    """
    Create contract for a company-specific custom control.

    Custom controls are operational controls created by the tenant.
    They must not be treated as canonical standard controls.
    """

    standard_version_id: int


class ControlUpdate(BaseModel):
    """
    Partial update contract.

    standard_version_id is immutable through this endpoint.
    """

    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    requirement_id: Optional[int] = None


class ControlRequirement(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ControlClause(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ControlStandard(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ControlStandardVersion(BaseModel):
    id: int
    version_code: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class ControlInDBBase(ControlBase):
    id: int
    standard_version_id: int
    origin: str

    model_config = ConfigDict(from_attributes=True)


class Control(ControlInDBBase):
    """
    Enterprise Control API representation.

    Controls are explicitly classified as either canonical
    standard controls or tenant-created custom controls.
    """

    requirement: Optional[ControlRequirement] = None
    clause: Optional[ControlClause] = None
    standard: Optional[ControlStandard] = None
    standard_version: Optional[ControlStandardVersion] = None

    evidences: List[Evidence] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ControlInDB(ControlInDBBase):
    model_config = ConfigDict(from_attributes=True)
