from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class EvidenceStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_review = "in_review"
    not_applicable = "not_applicable"
    uploaded = "uploaded"
    waiting_approval = "waiting_approval"


# Production contains legacy values such as Approved, PendingApproval and Uploaded.
# Normalize them at the API boundary; do not rewrite existing database records.
_EVIDENCE_STATUS_ALIASES = {
    "approved": EvidenceStatus.approved,
    "pendingapproval": EvidenceStatus.waiting_approval,
    "pending_approval": EvidenceStatus.waiting_approval,
    "waitingapproval": EvidenceStatus.waiting_approval,
    "waiting_approval": EvidenceStatus.waiting_approval,
    "uploaded": EvidenceStatus.uploaded,
    "upload": EvidenceStatus.uploaded,
    "pending": EvidenceStatus.pending,
    "inreview": EvidenceStatus.in_review,
    "in_review": EvidenceStatus.in_review,
    "rejected": EvidenceStatus.rejected,
    "notapplicable": EvidenceStatus.not_applicable,
    "not_applicable": EvidenceStatus.not_applicable,
    "draft": EvidenceStatus.pending,
}


def normalize_evidence_status(value: Any) -> EvidenceStatus:
    if isinstance(value, EvidenceStatus):
        return value
    if value is None:
        return EvidenceStatus.pending

    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    compact = normalized.replace("_", "")
    status = _EVIDENCE_STATUS_ALIASES.get(normalized) or _EVIDENCE_STATUS_ALIASES.get(compact)
    if status is not None:
        return status

    raise ValueError(f"Unsupported evidence status: {value}")


class EvidenceBase(BaseModel):
    title: str
    description: Optional[str] = None
    regulation: Optional[str] = None
    requirement_id: Optional[int] = None
    control_id: Optional[int] = None
    status: EvidenceStatus = EvidenceStatus.pending

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: Any) -> EvidenceStatus:
        return normalize_evidence_status(value)


class EvidenceCreate(EvidenceBase):
    """Yeni Evidence oluşturma şeması."""
    risk_id: Optional[int] = None


class EvidenceUpdate(BaseModel):
    """Kısmi güncelleme için şema."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[EvidenceStatus] = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: Any) -> Optional[EvidenceStatus]:
        if value is None:
            return None
        return normalize_evidence_status(value)


class EvidenceInDBBase(EvidenceBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Evidence(EvidenceInDBBase):
    """API response model with canonical evidence status values."""
    risk_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class EvidenceInDB(EvidenceInDBBase):
    model_config = ConfigDict(from_attributes=True)
