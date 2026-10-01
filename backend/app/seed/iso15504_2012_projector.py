from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.pam_runtime import (
    FrameworkModel,
    PamProcessCategory,
    PamProcessGroup,
    PamProcess,
    PamProcessOutcome,
    PamBasePractice,
    PamWorkProduct,
    PamProcessWorkProduct,
    PamCapabilityLevel,
    PamProcessAttribute,
    PamGenericPractice,
    PamGenericResource,
    PamGenericWorkProduct,
)
from app.seed.iso15504_2012_source import (
    Iso15504PamSource,
    ISO15504_2012_SOURCE,
)
from app.seed.iso15504_2012 import seed_iso15504_2012_framework


@dataclass(frozen=True)
class ProjectionContext:
    standard_id: int
    standard_version_id: int
    pam_framework_model_id: int
    cmf_framework_model_id: int


@dataclass(frozen=True)
class ProjectionResult:
    standard_id: int
    standard_version_id: int
    pam_framework_model_id: int
    cmf_framework_model_id: int
    process_categories: int
    process_groups: int
    processes: int
    outcomes: int
    base_practices: int
    work_products: int
    process_work_products: int
    capability_levels: int
    process_attributes: int
    generic_practices: int
    generic_resources: int
    generic_work_products: int


def _resolve_context(
    db: Session,
    source: Iso15504PamSource,
) -> ProjectionContext:
    ids = seed_iso15504_2012_framework(db)

    standard = (
        db.query(Standard)
        .filter(Standard.id == ids["standard_id"])
        .one()
    )

    version = (
        db.query(StandardVersion)
        .filter(StandardVersion.id == ids["standard_version_id"])
        .one()
    )

    pam = (
        db.query(FrameworkModel)
        .filter(
            FrameworkModel.id == ids["pam_framework_model_id"],
            FrameworkModel.standard_version_id == version.id,
            FrameworkModel.model_type == "PAM",
        )
        .one()
    )

    cmf = (
        db.query(FrameworkModel)
        .filter(
            FrameworkModel.id == ids["cmf_framework_model_id"],
            FrameworkModel.standard_version_id == version.id,
            FrameworkModel.model_type == "CMF",
        )
        .one()
    )

    if standard.code != source.standard_code:
        raise RuntimeError("Standard code mismatch")

    if standard.type != "MATURITY_BASED":
        raise RuntimeError("Standard type mismatch")

    if version.version_code != source.version_code:
        raise RuntimeError("Standard version mismatch")

    if pam.code != source.pam_code:
        raise RuntimeError("PAM code mismatch")

    if cmf.code != source.cmf_code:
        raise RuntimeError("CMF code mismatch")

    return ProjectionContext(
        standard_id=standard.id,
        standard_version_id=version.id,
        pam_framework_model_id=pam.id,
        cmf_framework_model_id=cmf.id,
    )


def _validate_source(source: Iso15504PamSource) -> None:
    if source.standard_code != "ISO15504":
        raise RuntimeError("Unexpected standard code")

    if source.version_code != "2012":
        raise RuntimeError("Unexpected standard version")

    if source.language != "en":
        raise RuntimeError("Canonical source language must be English")

    category_codes: set[str] = set()
    group_codes: set[str] = set()
    process_codes: set[str] = set()
    work_product_codes: set[str] = set()
    capability_levels: set[int] = set()
    process_attribute_codes: set[str] = set()

    for work_product in source.work_products:
        if work_product.code in work_product_codes:
            raise RuntimeError(
                f"Duplicate work product code: {work_product.code}"
            )
        work_product_codes.add(work_product.code)

    for category in source.categories:
        if category.code in category_codes:
            raise RuntimeError(
                f"Duplicate process category code: {category.code}"
            )
        category_codes.add(category.code)

        for group in category.groups:
            group_key = f"{category.code}:{group.code}"

            if group_key in group_codes:
                raise RuntimeError(
                    f"Duplicate process group: {group_key}"
                )
            group_codes.add(group_key)

            for process in group.processes:
                if process.code in process_codes:
                    raise RuntimeError(
                        f"Duplicate process code: {process.code}"
                    )
                process_codes.add(process.code)

                outcome_codes: set[str] = set()
                base_practice_codes: set[str] = set()

                for outcome in process.outcomes:
                    if outcome.code in outcome_codes:
                        raise RuntimeError(
                            f"Duplicate outcome code in {process.code}: "
                            f"{outcome.code}"
                        )
                    outcome_codes.add(outcome.code)

                for base_practice in process.base_practices:
                    if base_practice.code in base_practice_codes:
                        raise RuntimeError(
                            f"Duplicate base practice code in "
                            f"{process.code}: {base_practice.code}"
                        )
                    base_practice_codes.add(base_practice.code)

                    for code in base_practice.work_product_codes:
                        if code not in work_product_codes:
                            raise RuntimeError(
                                f"Unknown work product {code} referenced "
                                f"by base practice {base_practice.code}"
                            )

                for relation in process.work_products:
                    if relation.work_product_code not in work_product_codes:
                        raise RuntimeError(
                            f"Unknown work product "
                            f"{relation.work_product_code} referenced "
                            f"by process {process.code}"
                        )

    for capability_level in source.capability_levels:
        if capability_level.level in capability_levels:
            raise RuntimeError(
                f"Duplicate capability level: "
                f"{capability_level.level}"
            )
        capability_levels.add(capability_level.level)

        for attribute in capability_level.process_attributes:
            if attribute.code in process_attribute_codes:
                raise RuntimeError(
                    f"Duplicate process attribute code: "
                    f"{attribute.code}"
                )
            process_attribute_codes.add(attribute.code)


def _project_pam_runtime(
    db: Session,
    source: Iso15504PamSource,
    context: ProjectionContext,
) -> None:
    work_products: dict[str, PamWorkProduct] = {}

    for item in source.work_products:
        row = (
            db.query(PamWorkProduct)
            .filter(
                PamWorkProduct.framework_model_id
                == context.pam_framework_model_id,
                PamWorkProduct.code == item.code,
            )
            .one_or_none()
        )

        if row is None:
            row = PamWorkProduct(
                framework_model_id=context.pam_framework_model_id,
                code=item.code,
                name=item.name,
                description=item.description,
                characteristics=item.characteristics,
            )
            db.add(row)
            db.flush()

        work_products[item.code] = row

    for category_source in source.categories:
        category = (
            db.query(PamProcessCategory)
            .filter(
                PamProcessCategory.framework_model_id
                == context.pam_framework_model_id,
                PamProcessCategory.code == category_source.code,
            )
            .one_or_none()
        )

        if category is None:
            category = PamProcessCategory(
                framework_model_id=context.pam_framework_model_id,
                code=category_source.code,
                name=category_source.name,
                description=category_source.description,
                sort_order=category_source.sort_order,
            )
            db.add(category)
            db.flush()

        for group_source in category_source.groups:
            group = (
                db.query(PamProcessGroup)
                .filter(
                    PamProcessGroup.category_id == category.id,
                    PamProcessGroup.code == group_source.code,
                )
                .one_or_none()
            )

            if group is None:
                group = PamProcessGroup(
                    category_id=category.id,
                    code=group_source.code,
                    name=group_source.name,
                    description=group_source.description,
                    sort_order=group_source.sort_order,
                )
                db.add(group)
                db.flush()

            for process_source in group_source.processes:
                process = (
                    db.query(PamProcess)
                    .filter(
                        PamProcess.framework_model_id
                        == context.pam_framework_model_id,
                        PamProcess.code == process_source.code,
                    )
                    .one_or_none()
                )

                if process is None:
                    process = PamProcess(
                        framework_model_id=context.pam_framework_model_id,
                        process_group_id=group.id,
                        code=process_source.code,
                        name=process_source.name,
                        purpose=process_source.purpose,
                        description=process_source.description,
                        sort_order=process_source.sort_order,
                    )
                    db.add(process)
                    db.flush()

                for outcome_source in process_source.outcomes:
                    outcome = (
                        db.query(PamProcessOutcome)
                        .filter(
                            PamProcessOutcome.process_id == process.id,
                            PamProcessOutcome.code == outcome_source.code,
                        )
                        .one_or_none()
                    )

                    if outcome is None:
                        db.add(
                            PamProcessOutcome(
                                process_id=process.id,
                                code=outcome_source.code,
                                text=outcome_source.text,
                                sort_order=outcome_source.sort_order,
                            )
                        )

                for base_source in process_source.base_practices:
                    base_practice = (
                        db.query(PamBasePractice)
                        .filter(
                            PamBasePractice.process_id == process.id,
                            PamBasePractice.code == base_source.code,
                        )
                        .one_or_none()
                    )

                    if base_practice is None:
                        db.add(
                            PamBasePractice(
                                process_id=process.id,
                                code=base_source.code,
                                text=base_source.text,
                                guidance=base_source.guidance,
                                sort_order=base_source.sort_order,
                            )
                        )

                for relation_source in process_source.work_products:
                    work_product = work_products[
                        relation_source.work_product_code
                    ]

                    relation = (
                        db.query(PamProcessWorkProduct)
                        .filter(
                            PamProcessWorkProduct.process_id == process.id,
                            PamProcessWorkProduct.work_product_id
                            == work_product.id,
                            PamProcessWorkProduct.direction
                            == relation_source.direction,
                        )
                        .one_or_none()
                    )

                    if relation is None:
                        db.add(
                            PamProcessWorkProduct(
                                process_id=process.id,
                                work_product_id=work_product.id,
                                direction=relation_source.direction,
                                sort_order=relation_source.sort_order,
                            )
                        )

    for level_source in source.capability_levels:
        level = (
            db.query(PamCapabilityLevel)
            .filter(
                PamCapabilityLevel.framework_model_id
                == context.cmf_framework_model_id,
                PamCapabilityLevel.level == level_source.level,
            )
            .one_or_none()
        )

        if level is None:
            level = PamCapabilityLevel(
                framework_model_id=context.cmf_framework_model_id,
                level=level_source.level,
                code=level_source.code,
                name=level_source.name,
                description=level_source.description,
                sort_order=level_source.sort_order,
            )
            db.add(level)
            db.flush()

        for attribute_source in level_source.process_attributes:
            attribute = (
                db.query(PamProcessAttribute)
                .filter(
                    PamProcessAttribute.capability_level_id == level.id,
                    PamProcessAttribute.code == attribute_source.code,
                )
                .one_or_none()
            )

            if attribute is None:
                attribute = PamProcessAttribute(
                    capability_level_id=level.id,
                    code=attribute_source.code,
                    name=attribute_source.name,
                    description=attribute_source.description,
                    sort_order=attribute_source.sort_order,
                )
                db.add(attribute)
                db.flush()

            for indicator in attribute_source.indicators:
                if indicator.kind == "GENERIC_PRACTICE":
                    model = PamGenericPractice
                elif indicator.kind == "GENERIC_RESOURCE":
                    model = PamGenericResource
                elif indicator.kind == "GENERIC_WORK_PRODUCT":
                    model = PamGenericWorkProduct
                else:
                    raise RuntimeError(
                        f"Unsupported indicator kind: {indicator.kind}"
                    )

                existing = (
                    db.query(model)
                    .filter(
                        model.process_attribute_id == attribute.id,
                        model.code == indicator.code,
                    )
                    .one_or_none()
                )

                if existing is None:
                    db.add(
                        model(
                            process_attribute_id=attribute.id,
                            code=indicator.code,
                            text=indicator.text,
                            guidance=indicator.guidance,
                            sort_order=indicator.sort_order,
                        )
                    )


def _count_runtime(
    db: Session,
    context: ProjectionContext,
) -> ProjectionResult:
    category_ids = [
        row[0]
        for row in (
            db.query(PamProcessCategory.id)
            .filter(
                PamProcessCategory.framework_model_id
                == context.pam_framework_model_id
            )
            .all()
        )
    ]

    group_ids = (
        [
            row[0]
            for row in (
                db.query(PamProcessGroup.id)
                .filter(PamProcessGroup.category_id.in_(category_ids))
                .all()
            )
        ]
        if category_ids
        else []
    )

    process_ids = [
        row[0]
        for row in (
            db.query(PamProcess.id)
            .filter(
                PamProcess.framework_model_id
                == context.pam_framework_model_id
            )
            .all()
        )
    ]

    capability_level_ids = [
        row[0]
        for row in (
            db.query(PamCapabilityLevel.id)
            .filter(
                PamCapabilityLevel.framework_model_id
                == context.cmf_framework_model_id
            )
            .all()
        )
    ]

    attribute_ids = (
        [
            row[0]
            for row in (
                db.query(PamProcessAttribute.id)
                .filter(
                    PamProcessAttribute.capability_level_id.in_(
                        capability_level_ids
                    )
                )
                .all()
            )
        ]
        if capability_level_ids
        else []
    )

    def count_for_ids(model, column, ids: list[int]) -> int:
        if not ids:
            return 0
        return (
            db.query(model)
            .filter(column.in_(ids))
            .count()
        )

    return ProjectionResult(
        standard_id=context.standard_id,
        standard_version_id=context.standard_version_id,
        pam_framework_model_id=context.pam_framework_model_id,
        cmf_framework_model_id=context.cmf_framework_model_id,
        process_categories=len(category_ids),
        process_groups=len(group_ids),
        processes=len(process_ids),
        outcomes=count_for_ids(
            PamProcessOutcome,
            PamProcessOutcome.process_id,
            process_ids,
        ),
        base_practices=count_for_ids(
            PamBasePractice,
            PamBasePractice.process_id,
            process_ids,
        ),
        work_products=(
            db.query(PamWorkProduct)
            .filter(
                PamWorkProduct.framework_model_id
                == context.pam_framework_model_id
            )
            .count()
        ),
        process_work_products=count_for_ids(
            PamProcessWorkProduct,
            PamProcessWorkProduct.process_id,
            process_ids,
        ),
        capability_levels=len(capability_level_ids),
        process_attributes=len(attribute_ids),
        generic_practices=count_for_ids(
            PamGenericPractice,
            PamGenericPractice.process_attribute_id,
            attribute_ids,
        ),
        generic_resources=count_for_ids(
            PamGenericResource,
            PamGenericResource.process_attribute_id,
            attribute_ids,
        ),
        generic_work_products=count_for_ids(
            PamGenericWorkProduct,
            PamGenericWorkProduct.process_attribute_id,
            attribute_ids,
        ),
    )


def project_iso15504_2012_runtime(
    db: Session,
    source: Iso15504PamSource = ISO15504_2012_SOURCE,
) -> ProjectionResult:
    _validate_source(source)

    context = _resolve_context(db, source)

    _project_pam_runtime(
        db=db,
        source=source,
        context=context,
    )

    db.flush()

    return _count_runtime(db, context)
