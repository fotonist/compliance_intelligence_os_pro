from __future__ import annotations

import json
from pathlib import Path

from app.seed.iso15504_2012_source import (
    BasePracticeSource,
    CapabilityIndicatorSource,
    CapabilityLevelSource,
    Iso15504PamSource,
    OutcomeSource,
    ProcessAttributeSource,
    ProcessCategorySource,
    ProcessGroupSource,
    ProcessSource,
    ProcessWorkProductSource,
    WorkProductSource,
)


DATA_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "iso15504_2012.json"
)


def _load_json() -> dict:
    with DATA_FILE.open(
        "r",
        encoding="utf-8-sig",
    ) as handle:
        return json.load(handle)


def _outcome(item: dict) -> OutcomeSource:
    return OutcomeSource(
        code=item["code"],
        text=item["text"],
        sort_order=item["sort_order"],
    )


def _process_work_product(
    item: dict,
) -> ProcessWorkProductSource:
    return ProcessWorkProductSource(
        work_product_code=item["work_product_code"],
        direction=item["direction"],
        sort_order=item["sort_order"],
    )


def _base_practice(item: dict) -> BasePracticeSource:
    return BasePracticeSource(
        code=item["code"],
        title=item["title"],
        text=item["text"],
        guidance=item.get("guidance"),
        sort_order=item["sort_order"],
        work_product_codes=tuple(
            item.get("work_product_codes", [])
        ),
    )


def _process(item: dict) -> ProcessSource:
    return ProcessSource(
        code=item["code"],
        name=item["name"],
        purpose=item["purpose"],
        description=item.get("description"),
        sort_order=item["sort_order"],
        outcomes=tuple(
            _outcome(value)
            for value in item.get("outcomes", [])
        ),
        base_practices=tuple(
            _base_practice(value)
            for value in item.get("base_practices", [])
        ),
        work_products=tuple(
            _process_work_product(value)
            for value in item.get("work_products", [])
        ),
    )


def _group(item: dict) -> ProcessGroupSource:
    return ProcessGroupSource(
        code=item["code"],
        name=item["name"],
        description=item.get("description"),
        sort_order=item["sort_order"],
        processes=tuple(
            _process(value)
            for value in item.get("processes", [])
        ),
    )


def _category(item: dict) -> ProcessCategorySource:
    return ProcessCategorySource(
        code=item["code"],
        name=item["name"],
        description=item.get("description"),
        sort_order=item["sort_order"],
        groups=tuple(
            _group(value)
            for value in item.get("groups", [])
        ),
    )


def _work_product(item: dict) -> WorkProductSource:
    return WorkProductSource(
        code=item["code"],
        name=item["name"],
        description=item.get("description"),
        characteristics=tuple(
            item.get("characteristics", [])
        ),
    )


def _indicator(
    item: dict,
) -> CapabilityIndicatorSource:
    return CapabilityIndicatorSource(
        kind=item["kind"],
        code=item["code"],
        text=item["text"],
        guidance=item.get("guidance"),
        sort_order=item["sort_order"],
    )


def _attribute(item: dict) -> ProcessAttributeSource:
    return ProcessAttributeSource(
        code=item["code"],
        name=item["name"],
        description=item.get("description"),
        sort_order=item["sort_order"],
        indicators=tuple(
            _indicator(value)
            for value in item.get("indicators", [])
        ),
    )


def _level(item: dict) -> CapabilityLevelSource:
    return CapabilityLevelSource(
        level=item["level"],
        code=item["code"],
        name=item["name"],
        description=item.get("description"),
        sort_order=item["sort_order"],
        process_attributes=tuple(
            _attribute(value)
            for value in item.get(
                "process_attributes",
                [],
            )
        ),
    )




def validate_pending_process_taxonomy(raw: dict) -> None:
    pending = raw.get("pending_process_taxonomy")

    if pending is None:
        return

    if pending.get("canonical") is not False:
        raise ValueError(
            "Pending process taxonomy must not be canonical"
        )

    if pending.get("status") != "awaiting_verified_category_mapping":
        raise ValueError(
            "Unexpected pending process taxonomy status"
        )

    groups = pending.get("groups")

    if not isinstance(groups, list):
        raise ValueError(
            "Pending process taxonomy groups must be a list"
        )

    if len(groups) != 7:
        raise ValueError(
            "ISO15504 2012 pending taxonomy must contain 7 groups"
        )

    expected_counts = {
        "AGR": 10,
        "ORG": 13,
        "PRO": 7,
        "ENG": 13,
        "DEV": 6,
        "SUP": 8,
        "REU": 3,
    }

    expected_order = [
        "AGR",
        "ORG",
        "PRO",
        "ENG",
        "DEV",
        "SUP",
        "REU",
    ]

    actual_order = []
    group_codes = set()
    process_codes = set()
    process_count = 0

    for group_index, group in enumerate(groups):
        code = str(group.get("code") or "").strip()
        name = str(group.get("name") or "").strip()

        if not code:
            raise ValueError("Pending group code is required")

        if not name:
            raise ValueError(
                "Pending group name is required: " + code
            )

        if code in group_codes:
            raise ValueError(
                "Duplicate pending group code: " + code
            )

        group_codes.add(code)
        actual_order.append(code)

        if group.get("sort_order") != group_index:
            raise ValueError(
                "Invalid pending group sort order: " + code
            )

        processes = group.get("processes")

        if not isinstance(processes, list):
            raise ValueError(
                "Pending processes must be a list: " + code
            )

        expected_count = expected_counts.get(code)

        if expected_count is None:
            raise ValueError(
                "Unexpected pending group code: " + code
            )

        if len(processes) != expected_count:
            raise ValueError(
                "Unexpected process count for "
                + code
                + ": "
                + str(len(processes))
            )

        for process_index, process in enumerate(processes):
            process_code = str(
                process.get("code") or ""
            ).strip()

            process_name = str(
                process.get("name") or ""
            ).strip()

            if not process_code:
                raise ValueError(
                    "Pending process code is required"
                )

            if not process_name:
                raise ValueError(
                    "Pending process name is required: "
                    + process_code
                )

            if process_code in process_codes:
                raise ValueError(
                    "Duplicate pending process code: "
                    + process_code
                )

            if not process_code.startswith(code + "."):
                raise ValueError(
                    "Process/group prefix mismatch: "
                    + process_code
                    + " -> "
                    + code
                )

            if process.get("sort_order") != process_index:
                raise ValueError(
                    "Invalid pending process sort order: "
                    + process_code
                )

            process_codes.add(process_code)
            process_count += 1

    if actual_order != expected_order:
        raise ValueError(
            "Unexpected ISO15504 2012 group order: "
            + repr(actual_order)
        )

    if process_count != 60:
        raise ValueError(
            "ISO15504 2012 pending taxonomy must contain 60 processes"
        )

    if len(process_codes) != 60:
        raise ValueError(
            "ISO15504 2012 process codes must be unique"
        )



def load_iso15504_2012_source() -> Iso15504PamSource:
    raw = _load_json()
    validate_pending_process_taxonomy(raw)

    source_meta = raw.get("source", {})

    return Iso15504PamSource(
        standard_code=raw["standard_code"],
        version_code=raw["version_code"],
        pam_code=raw["pam_code"],
        cmf_code=raw["cmf_code"],
        language=raw["language"],
        categories=tuple(
            _category(value)
            for value in raw.get("categories", [])
        ),
        work_products=tuple(
            _work_product(value)
            for value in raw.get("work_products", [])
        ),
        capability_levels=tuple(
            _level(value)
            for value in raw.get(
                "capability_levels",
                [],
            )
        ),
        metadata={
            "standard_part": "ISO/IEC 15504-5",
            "edition": "2012",
            "source_status": source_meta.get(
                "status",
                "unknown",
            ),
            "source_standard": source_meta.get(
                "standard",
                "ISO/IEC 15504-5:2012",
            ),
        },
    )
