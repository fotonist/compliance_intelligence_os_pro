from pathlib import Path
from typing import BinaryIO
import hashlib
import shutil
import uuid

from app.core.config import settings


class DocumentStorage:

    @property
    def root(self) -> Path:
        return Path(settings.DOCUMENT_STORAGE_ROOT)

    @property
    def governance_root(self) -> Path:
        return self.root / settings.GOVERNANCE_STORAGE_ROOT

    def _tenant_root(self, tenant_id: int) -> Path:
        return self.governance_root / str(tenant_id)

    def staging_directory(
        self,
        tenant_id: int,
        procedure_id: int,
    ) -> Path:
        return (
            self._tenant_root(tenant_id)
            / "_staging"
            / "procedures"
            / str(procedure_id)
        )

    def archive_directory(
        self,
        tenant_id: int,
        procedure_id: int,
        version: str,
    ) -> Path:
        safe_version = (
            str(version)
            .replace("/", "_")
            .replace("\\", "_")
        )

        return (
            self._tenant_root(tenant_id)
            / "_archive"
            / "procedures"
            / str(procedure_id)
            / f"v{safe_version}"
        )

    def save_staging(
        self,
        tenant_id: int,
        procedure_id: int,
        source: BinaryIO,
        original_filename: str,
    ) -> tuple[Path, str, int, str]:

        directory = self.staging_directory(
            tenant_id,
            procedure_id,
        )

        directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        extension = Path(
            original_filename or ""
        ).suffix

        file_id = uuid.uuid4().hex

        filename = f"{file_id}{extension}"

        target = directory / filename

        sha256 = hashlib.sha256()

        file_size = 0

        with target.open("wb") as output:

            while True:

                chunk = source.read(1024 * 1024)

                if not chunk:
                    break

                output.write(chunk)
                sha256.update(chunk)
                file_size += len(chunk)

        storage_key = str(
            target.relative_to(self.root)
        ).replace("\\", "/")

        return (
            target,
            storage_key,
            file_size,
            sha256.hexdigest(),
        )

    def move_to_archive(
        self,
        source_path: str | Path,
        tenant_id: int,
        procedure_id: int,
        version: str,
    ) -> tuple[Path, str]:

        source = Path(source_path)

        if not source.exists():
            raise FileNotFoundError(
                f"Document not found: {source}"
            )

        directory = self.archive_directory(
            tenant_id,
            procedure_id,
            version,
        )

        directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        target = directory / source.name

        shutil.move(
            str(source),
            str(target),
        )

        storage_key = str(
            target.relative_to(self.root)
        ).replace("\\", "/")

        return target, storage_key

    def restore_from_archive(
        self,
        source_path: str | Path,
        tenant_id: int,
        procedure_id: int,
    ) -> tuple[Path, str]:

        source = Path(source_path)

        if not source.exists():
            raise FileNotFoundError(
                f"Archived document not found: {source}"
            )

        directory = self.staging_directory(
            tenant_id,
            procedure_id,
        )

        directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        target = directory / source.name

        shutil.move(
            str(source),
            str(target),
        )

        storage_key = str(
            target.relative_to(self.root)
        ).replace("\\", "/")

        return target, storage_key

    def exists(
        self,
        storage_key: str,
    ) -> bool:

        return (
            self.root / storage_key
        ).exists()

    def absolute_path(
        self,
        storage_key: str,
    ) -> Path:

        return self.root / storage_key

    def delete(
        self,
        storage_key: str,
    ) -> bool:

        path = self.absolute_path(
            storage_key
        )

        if not path.exists():
            return False

        path.unlink()

        return True


document_storage = DocumentStorage()
