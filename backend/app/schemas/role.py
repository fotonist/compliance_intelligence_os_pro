from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ==========================================================
# Role Summary
# Used by User Management / role lookup endpoints.
# ==========================================================

class RoleSummary(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Role Base
# ==========================================================

class RoleBase(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=500,
    )


# ==========================================================
# Role Create
# ==========================================================

class RoleCreate(RoleBase):
    is_active: bool = True


# ==========================================================
# Role Update
# ==========================================================

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    is_active: Optional[bool] = None


# ==========================================================
# Role Read
# ==========================================================

class Role(RoleBase):
    id: int

    is_active: bool

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True
    )


# ==========================================================
# Role Management List / Detail
# ==========================================================

class RoleManagementRead(Role):
    user_count: int = 0
    permission_count: int = 0


# ==========================================================
# Role Permission
# ==========================================================

class RolePermissionRead(BaseModel):
    id: int
    code: str
    description: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True
    )


# ==========================================================
# Role Permission Assignment
# ==========================================================

class RolePermissionUpdate(BaseModel):
    permission_ids: list[int] = Field(
        default_factory=list
    )
