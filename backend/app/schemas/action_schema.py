from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ActionBase(BaseModel):
    title: str
    description: Optional[str] = None
    risk_id: Optional[int] = None
    owner_id: Optional[int] = None      # Aksiyondan sorumlu kişi
    due_date: Optional[datetime] = None
    status: Optional[str] = "open"      # open / in-progress / completed


class ActionCreate(ActionBase):
    """Aksiyon oluşturma şeması."""
    pass


class ActionUpdate(BaseModel):
    """Aksiyon güncelleme şeması (kısmi alanlar)."""
    title: Optional[str] = None
    description: Optional[str] = None
    risk_id: Optional[int] = None
    owner_id: Optional[int] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None


class ActionInDBBase(ActionBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Action(ActionInDBBase):
    """API’nin döneceği aksiyon modeli."""
    model_config = ConfigDict(from_attributes=True)


class ActionInDB(ActionInDBBase):
    model_config = ConfigDict(from_attributes=True)