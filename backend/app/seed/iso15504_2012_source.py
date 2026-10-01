from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


WorkProductDirection = Literal["INPUT", "OUTPUT"]
IndicatorKind = Literal[
    "GENERIC_PRACTICE",
    "GENERIC_RESOURCE",
    "GENERIC_WORK_PRODUCT",
]


@dataclass(frozen=True)
class OutcomeSource:
    code: str
    text: str
    sort_order: int


@dataclass(frozen=True)
class BasePracticeSource:
    code: str
    title: str
    text: str
    guidance: str | None
    sort_order: int
    work_product_codes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProcessWorkProductSource:
    work_product_code: str
    direction: WorkProductDirection
    sort_order: int


@dataclass(frozen=True)
class ProcessSource:
    code: str
    name: str
    purpose: str
    description: str | None
    sort_order: int
    outcomes: tuple[OutcomeSource, ...] = ()
    base_practices: tuple[BasePracticeSource, ...] = ()
    work_products: tuple[ProcessWorkProductSource, ...] = ()


@dataclass(frozen=True)
class ProcessGroupSource:
    code: str
    name: str
    description: str | None
    sort_order: int
    processes: tuple[ProcessSource, ...] = ()


@dataclass(frozen=True)
class ProcessCategorySource:
    code: str
    name: str
    description: str | None
    sort_order: int
    groups: tuple[ProcessGroupSource, ...] = ()


@dataclass(frozen=True)
class WorkProductSource:
    code: str
    name: str
    description: str | None
    characteristics: dict[str, Any] | None = None


@dataclass(frozen=True)
class CapabilityIndicatorSource:
    kind: IndicatorKind
    code: str
    text: str
    guidance: str | None
    sort_order: int


@dataclass(frozen=True)
class ProcessAttributeSource:
    code: str
    name: str
    description: str | None
    sort_order: int
    indicators: tuple[CapabilityIndicatorSource, ...] = ()


@dataclass(frozen=True)
class CapabilityLevelSource:
    level: int
    code: str
    name: str
    description: str | None
    sort_order: int
    process_attributes: tuple[ProcessAttributeSource, ...] = ()


@dataclass(frozen=True)
class Iso15504PamSource:
    standard_code: str
    version_code: str
    pam_code: str
    cmf_code: str
    language: str
    categories: tuple[ProcessCategorySource, ...] = ()
    work_products: tuple[WorkProductSource, ...] = ()
    capability_levels: tuple[CapabilityLevelSource, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)


ISO15504_2012_SOURCE = Iso15504PamSource(
    standard_code="ISO15504",
    version_code="2012",
    pam_code="ISO15504-5-2012-PAM",
    cmf_code="ISO15504-2-2003-CMF",
    language="en",
    categories=(),
    work_products=(),
    capability_levels=(),
    metadata={
        "standard_part": "ISO/IEC 15504-5",
        "edition": "2012",
        "source_status": "structure_only",
    },
)
