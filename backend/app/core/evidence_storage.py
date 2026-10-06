from __future__ import annotations

from pathlib import Path
from typing import Union


BACKEND_ROOT = Path(__file__).resolve().parents[2]

UPLOAD_ROOT = BACKEND_ROOT / "uploads"

EVIDENCE_ROOT = UPLOAD_ROOT / "evidences"

CONTROL_EVIDENCE_ROOT = EVIDENCE_ROOT / "control"
CONTROL_STAGING_ROOT = CONTROL_EVIDENCE_ROOT / "_staging"
CONTROL_ARCHIVE_ROOT = CONTROL_EVIDENCE_ROOT / "_archive"

MATURITY_EVIDENCE_ROOT = EVIDENCE_ROOT / "maturity"
MATURITY_STAGING_ROOT = MATURITY_EVIDENCE_ROOT / "_staging"
MATURITY_ARCHIVE_ROOT = MATURITY_EVIDENCE_ROOT / "_archive"


def ensure_directory(path: Path) -> Path:
    path.mkdir(
        parents=True,
        exist_ok=True,
    )
    return path


def ensure_within_root(
    path: Union[str, Path],
    root: Union[str, Path],
) -> Path:
    candidate = Path(path).resolve()
    allowed_root = Path(root).resolve()

    try:
        candidate.relative_to(allowed_root)
    except ValueError as exc:
        raise ValueError(
            "Storage path is outside the allowed root."
        ) from exc

    return candidate


def to_backend_relative(
    path: Union[str, Path],
) -> str:
    candidate = ensure_within_root(
        path,
        BACKEND_ROOT,
    )

    return candidate.relative_to(
        BACKEND_ROOT,
    ).as_posix()


def control_staging_directory(
    tenant_id: int,
    evidence_id: int,
) -> Path:
    return ensure_directory(
        CONTROL_STAGING_ROOT
        / str(int(tenant_id))
        / str(int(evidence_id))
    )


def control_archive_directory(
    tenant_id: int,
    standard_code: str,
    standard_version: str,
    evidence_id: int,
    version: int,
) -> Path:
    safe_standard = (
        str(standard_code)
        .strip()
        .replace("/", "_")
        .replace("\\", "_")
    )

    safe_version = (
        str(standard_version)
        .strip()
        .replace("/", "_")
        .replace("\\", "_")
    )

    return ensure_directory(
        CONTROL_ARCHIVE_ROOT
        / str(int(tenant_id))
        / safe_standard
        / safe_version
        / "evidence"
        / str(int(evidence_id))
        / f"v{int(version)}"
    )


def maturity_staging_directory(
    tenant_id: int,
    session_id: int,
    evidence_id: int,
) -> Path:
    return ensure_directory(
        MATURITY_STAGING_ROOT
        / str(int(tenant_id))
        / str(int(session_id))
        / str(int(evidence_id))
    )


def resolve_control_file_path(
    stored_path: Union[str, Path],
) -> Path:
    candidate = Path(stored_path)

    if not candidate.is_absolute():
        candidate = BACKEND_ROOT / candidate

    return ensure_within_root(
        candidate,
        CONTROL_EVIDENCE_ROOT,
    )


def resolve_maturity_file_path(
    stored_path: Union[str, Path],
) -> Path:
    candidate = Path(stored_path)

    if not candidate.is_absolute():
        candidate = BACKEND_ROOT / candidate

    return ensure_within_root(
        candidate,
        MATURITY_EVIDENCE_ROOT,
    )
