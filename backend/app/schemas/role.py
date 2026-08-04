from typing import Optional
from pydantic import BaseModel, ConfigDict


class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    """Rol oluşturmak için kullanılacak şema."""
    pass


class RoleUpdate(BaseModel):
    """Rol güncellemek için şema."""
    name: Optional[str] = None


class Role(RoleBase):
    id: int

    model_config = ConfigDict(from_attributes=True)