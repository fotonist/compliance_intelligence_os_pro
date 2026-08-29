from datetime import datetime
from typing import List, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    TypeAdapter,
    field_validator,
)

from app.schemas.role import Role as RoleRead
from app.core.validation import validate_password_strength


# ==========================================================
# Email Validation
# ==========================================================

_email_adapter = TypeAdapter(EmailStr)


def validate_system_email(value: str) -> str:
    """
    Validate normal email addresses with Pydantic EmailStr.

    Internal/system users may use reserved .local domains,
    for example:

        admin@default.local
        superadmin@compliance.local

    These addresses are intentionally accepted because they
    are valid internal application identities even though
    Pydantic's EmailStr rejects reserved/special-use domains.
    """

    if not isinstance(value, str):
        raise ValueError("Email must be a string")

    value = value.strip().lower()

    if not value:
        raise ValueError("Email must not be empty")

    if "@" not in value:
        raise ValueError("Invalid email address")

    local_part, domain = value.rsplit("@", 1)

    if not local_part or not domain:
        raise ValueError("Invalid email address")

    # ------------------------------------------------------
    # Internal .local addresses
    # ------------------------------------------------------
    if domain.endswith(".local"):
        if (
            len(local_part) > 0
            and len(domain) > len(".local")
            and "." in domain
        ):
            return value

        raise ValueError("Invalid internal email address")

    # ------------------------------------------------------
    # Standard email validation
    # ------------------------------------------------------
    try:
        validated = _email_adapter.validate_python(value)
        return str(validated)
    except Exception as exc:
        raise ValueError("Invalid email address") from exc


# ==========================================================
# Base
# ==========================================================

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return validate_system_email(value)


# ==========================================================
# Create
# ==========================================================

class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

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

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class PasswordResetRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

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
