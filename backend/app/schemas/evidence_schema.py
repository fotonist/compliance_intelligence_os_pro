from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class EvidenceStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_review = "in_review"
    not_applicable = "not_applicable"
    uploaded = "uploaded"
    waiting_approval = "waiting_approval"


# --------------------------------------------------------------
# BASE SCHEMA
# --------------------------------------------------------------

class EvidenceBase(BaseModel):
    title: str
    description: Optional[str] = None
    regulation: Optional[str] = None
    requirement_id: Optional[int] = None
    control_id: Optional[int] = None

    # 🔥 STATUS ENUM → her zaman standart değer gelir / gider
    status: EvidenceStatus = EvidenceStatus.pending


# --------------------------------------------------------------
# CREATE
# --------------------------------------------------------------

class EvidenceCreate(EvidenceBase):
    """
    Yeni Evidence oluşturma şeması.

    🔧 STEP 1 UYUM:
    - UI tarafından gönderilen risk_id burada kabul edilir
    - DB kolonu DEĞİLDİR (pivot ilişki için kullanılır)
    """
    risk_id: Optional[int] = None


# --------------------------------------------------------------
# UPDATE
# --------------------------------------------------------------

class EvidenceUpdate(BaseModel):
    """Kısmi güncelleme için şema."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[EvidenceStatus] = None


# --------------------------------------------------------------
# INTERNAL MODELS
# --------------------------------------------------------------

class EvidenceInDBBase(EvidenceBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Evidence(EvidenceInDBBase):
    """
    API response modeli.

    🔧 STEP 1 UYUM:
    - UI tarafı evidence.risk_id beklediği için
      response seviyesinde expose edilir
    """
    risk_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class EvidenceInDB(EvidenceInDBBase):
    model_config = ConfigDict(from_attributes=True)