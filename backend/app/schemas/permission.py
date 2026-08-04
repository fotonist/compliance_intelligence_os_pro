from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class Permission(PermissionBase):
    id: int

    is_active: bool

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)