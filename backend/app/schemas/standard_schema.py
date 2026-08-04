from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class StandardCreate(BaseModel):
    code: str
    title: Optional[str] = None
    description: Optional[str] = None
    type: str
    version: Optional[str] = None


class StandardResponse(BaseModel):
    id: int
    code: str
    title: Optional[str] = None
    description: Optional[str] = None
    type: str

    # 🔥 VERSION INFO (StandardVersion’dan)
    version: Optional[str] = None
    status: Optional[str] = None

    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)