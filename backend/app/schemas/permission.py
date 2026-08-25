from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ==========================================================
# Permission Base
# ==========================================================

class PermissionBase(BaseModel):
    code: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=255,
    )


# ==========================================================
# Permission Create
# ==========================================================

class PermissionCreate(PermissionBase):
    pass


# ==========================================================
# Permission Update
# ==========================================================

class PermissionUpdate(BaseModel):
    code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=128,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=255,
    )


# ==========================================================
# Permission Read
# ==========================================================

class Permission(PermissionBase):
    id: int

    model_config = ConfigDict(
        from_attributes=True
    )
