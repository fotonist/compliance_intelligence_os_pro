from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.role import Role as RoleRead


# ==========================================================
# Base
# ==========================================================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True


# ==========================================================
# Create
# ==========================================================

class UserCreate(UserBase):
    password: str

    phone: Optional[str] = None

    language: Optional[str] = "en"

    timezone: Optional[str] = "UTC"

    must_change_password: bool = False

    mfa_enabled: bool = False


# ==========================================================
# Update
# ==========================================================

class UserUpdate(BaseModel):
    full_name: Optional[str] = None

    phone: Optional[str] = None

    language: Optional[str] = None

    timezone: Optional[str] = None

    is_active: Optional[bool] = None

    is_locked: Optional[bool] = None

    must_change_password: Optional[bool] = None

    mfa_enabled: Optional[bool] = None


# ==========================================================
# Status Update
# ==========================================================

class UserStatusUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None


# ==========================================================
# Password
# ==========================================================

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    new_password: str
    must_change_password: bool = True


# ==========================================================
# Role Update
# ==========================================================

class UserRoleUpdate(BaseModel):
    role_ids: List[int]


# ==========================================================
# User Read
# ==========================================================

class User(UserBase):
    id: int

    tenant_id: int

    phone: Optional[str] = None

    language: Optional[str] = None

    timezone: Optional[str] = None

    is_locked: bool

    failed_login_attempts: int

    must_change_password: bool

    mfa_enabled: bool

    last_login_at: Optional[datetime] = None

    password_last_changed: Optional[datetime] = None

    created_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None

    created_by: Optional[int] = None

    updated_by: Optional[int] = None

    manager_id: Optional[int] = None

    roles: List[RoleRead] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# List Response
# ==========================================================

class UserListResponse(BaseModel):
    items: List[User]

    total: int

    page: int

    page_size: int


# ==========================================================
# Search
# ==========================================================

class UserSearchRequest(BaseModel):
    keyword: Optional[str] = None

    role_id: Optional[int] = None

    is_active: Optional[bool] = None

    is_locked: Optional[bool] = None

    tenant_id: Optional[int] = None