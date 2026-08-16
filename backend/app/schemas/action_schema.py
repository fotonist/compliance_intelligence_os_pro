from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ActionBase(BaseModel):
    requirement_id: int
    title: str
    description: Optional[str] = None
    risk_id: Optional[int] = None
    owner_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[str] = "OPEN"
    priority: Optional[str] = "MEDIUM"


class ActionCreate(ActionBase):
    pass


class ActionUpdate(BaseModel):
    requirement_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    risk_id: Optional[int] = None
    owner_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class ActionInDBBase(ActionBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Action(ActionInDBBase):
    pass


class ActionInDB(ActionInDBBase):
    pass
