from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


_DATA_DIR = Path(__file__).resolve().parents[1] / "seed" / "data"


class PamContentResolver:
    @staticmethod
    def _source_path(
        standard_code: str,
        version_code: str,
        language: str,
    ) -> Path:
        standard_key = standard_code.lower().replace("/", "").replace(" ", "")
        version_key = version_code.lower().replace("/", "").replace(" ", "")
        language_key = language.lower().strip()

        return _DATA_DIR / (
            standard_key
            + "_"
            + version_key
            + "_"
            + language_key
            + "_source.json"
        )

    @staticmethod
    @lru_cache(maxsize=32)
    def _load(
        standard_code: str,
        version_code: str,
        language: str,
    ) -> dict[str, Any]:
        path = PamContentResolver._source_path(
            standard_code,
            version_code,
            language,
        )

        if not path.exists():
            return {
                "standard": {},
                "base_practices": [],
                "work_products": [],
            }

        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)

        if not isinstance(raw, dict):
            raise ValueError("PAM content source must be a JSON object")

        return raw

    @classmethod
    def base_practice(
        cls,
        *,
        standard_code: str,
        version_code: str,
        language: str,
        process_code: str,
        practice_code: str,
    ) -> dict[str, Any] | None:
        raw = cls._load(
            standard_code,
            version_code,
            language,
        )

        for item in raw.get("base_practices", []):
            if (
                item.get("process_code") == process_code
                and item.get("code") == practice_code
            ):
                return item

        return None

    @classmethod
    def work_product(
        cls,
        *,
        standard_code: str,
        version_code: str,
        language: str,
        process_code: str,
        work_product_code: str,
    ) -> dict[str, Any] | None:
        raw = cls._load(
            standard_code,
            version_code,
            language,
        )

        for item in raw.get("work_products", []):
            if (
                item.get("process_code") == process_code
                and item.get("code") == work_product_code
            ):
                return item

        return None

    @classmethod
    def process_outcome(
        cls,
        *,
        standard_code: str,
        version_code: str,
        language: str,
        process_code: str,
        outcome_code: str,
    ) -> dict[str, Any] | None:
        raw = cls._load(
            standard_code,
            version_code,
            language,
        )

        for item in raw.get("process_outcomes", []):
            if (
                item.get("process_code") == process_code
                and item.get("code") == outcome_code
            ):
                return item

        return None

    @classmethod
    def content_status(
        cls,
        *,
        standard_code: str,
        version_code: str,
        language: str,
    ) -> dict[str, Any]:
        raw = cls._load(
            standard_code,
            version_code,
            language,
        )

        metadata = raw.get("standard") or {}

        base_practices = raw.get("base_practices") or []
        work_products = raw.get("work_products") or []

        bp_complete = sum(
            1
            for item in base_practices
            if item.get("title")
        )

        wp_complete = sum(
            1
            for item in work_products
            if item.get("title")
        )

        return {
            "standard_code": standard_code,
            "version_code": version_code,
            "language": language,
            "content_status": metadata.get("content_status"),
            "source_language": metadata.get("source_language"),
            "pam_model_code": metadata.get("pam_model_code"),
            "base_practices": {
                "total": len(base_practices),
                "localized": bp_complete,
            },
            "work_products": {
                "total": len(work_products),
                "localized": wp_complete,
            },
        }
