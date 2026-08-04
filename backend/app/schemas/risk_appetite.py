from pydantic import BaseModel, ConfigDict
from typing import Optional


class RiskAppetiteProfileResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_default: bool
    default_threshold: int

    model_config = ConfigDict(from_attributes=True)


class RiskAppetiteProfileUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    default_threshold: int


class ProcessRiskAppetiteResponse(BaseModel):
    process_id: int
    process_name: str
    threshold: int

    model_config = ConfigDict(from_attributes=True)


class ProcessRiskAppetiteUpdate(BaseModel):
    threshold_override: Optional[int] = None