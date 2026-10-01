from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.seed.iso15504_2012 import seed_iso15504_2012_framework
from app.seed.iso15504_2012_projector import _validate_source
from app.seed.iso15504_2012_source import (
    ISO15504_2012_SOURCE,
    Iso15504PamSource,
)


@dataclass(frozen=True)
class StandardProjectionResult:
    standard_id: int
    standard_version_id: int
    process_groups: int
    processes: int
    outcomes: int
    base_practices: int
    work_products: int
    process_work_products: int
    base_practice_work_products: int
    capability_levels: int
    process_attributes: int


def _one_or_create(
    db: Session,
    select_sql: str,
    select_params: dict,
    insert_sql: str,
    insert_params: dict,
) -> int:
    row_id = db.execute(
        text(select_sql),
        select_params,
    ).scalar_one_or_none()

    if row_id is not None:
        return int(row_id)

    return int(
        db.execute(
            text(insert_sql),
            insert_params,
        ).scalar_one()
    )


def project_iso15504_2012_standard(
    db: Session,
    source: Iso15504PamSource = ISO15504_2012_SOURCE,
) -> StandardProjectionResult:
    _validate_source(source)

    ids = seed_iso15504_2012_framework(db)

    standard_id = int(ids["standard_id"])
    version_id = int(ids["standard_version_id"])

    process_ids: dict[str, int] = {}
    base_practice_ids: dict[tuple[str, str], int] = {}
    process_wp_ids: dict[tuple[str, str], int] = {}

    source_wp = {
        item.code: item
        for item in source.work_products
    }

    for category in source.categories:
        for group in category.groups:
            group_id = _one_or_create(
                db,
                """
                SELECT id
                FROM standard_process_groups
                WHERE standard_version_id = :version_id
                  AND code = :code
                """,
                {
                    "version_id": version_id,
                    "code": group.code,
                },
                """
                INSERT INTO standard_process_groups (
                    standard_version_id,
                    code,
                    name,
                    description,
                    sort_order
                )
                VALUES (
                    :version_id,
                    :code,
                    :name,
                    :description,
                    :sort_order
                )
                RETURNING id
                """,
                {
                    "version_id": version_id,
                    "code": group.code,
                    "name": group.name,
                    "description": group.description,
                    "sort_order": group.sort_order,
                },
            )

            for process in group.processes:
                process_id = _one_or_create(
                    db,
                    """
                    SELECT id
                    FROM standard_reference_processes
                    WHERE standard_version_id = :version_id
                      AND code = :code
                    """,
                    {
                        "version_id": version_id,
                        "code": process.code,
                    },
                    """
                    INSERT INTO standard_reference_processes (
                        standard_version_id,
                        process_group_id,
                        code,
                        name,
                        purpose,
                        description,
                        sort_order
                    )
                    VALUES (
                        :version_id,
                        :group_id,
                        :code,
                        :name,
                        :purpose,
                        :description,
                        :sort_order
                    )
                    RETURNING id
                    """,
                    {
                        "version_id": version_id,
                        "group_id": group_id,
                        "code": process.code,
                        "name": process.name,
                        "purpose": process.purpose,
                        "description": process.description,
                        "sort_order": process.sort_order,
                    },
                )

                process_ids[process.code] = process_id

                for outcome in process.outcomes:
                    _one_or_create(
                        db,
                        """
                        SELECT id
                        FROM standard_process_outcomes
                        WHERE standard_version_id = :version_id
                          AND process_id = :process_id
                          AND code = :code
                        """,
                        {
                            "version_id": version_id,
                            "process_id": process_id,
                            "code": outcome.code,
                        },
                        """
                        INSERT INTO standard_process_outcomes (
                            standard_version_id,
                            process_id,
                            code,
                            title,
                            description,
                            sort_order
                        )
                        VALUES (
                            :version_id,
                            :process_id,
                            :code,
                            :title,
                            :description,
                            :sort_order
                        )
                        RETURNING id
                        """,
                        {
                            "version_id": version_id,
                            "process_id": process_id,
                            "code": outcome.code,
                            "title": outcome.text,
                            "description": None,
                            "sort_order": outcome.sort_order,
                        },
                    )

                for bp in process.base_practices:
                    bp_id = _one_or_create(
                        db,
                        """
                        SELECT id
                        FROM standard_base_practices
                        WHERE standard_version_id = :version_id
                          AND process_id = :process_id
                          AND code = :code
                        """,
                        {
                            "version_id": version_id,
                            "process_id": process_id,
                            "code": bp.code,
                        },
                        """
                        INSERT INTO standard_base_practices (
                            standard_version_id,
                            process_id,
                            code,
                            title,
                            description,
                            sort_order
                        )
                        VALUES (
                            :version_id,
                            :process_id,
                            :code,
                            :title,
                            :description,
                            :sort_order
                        )
                        RETURNING id
                        """,
                        {
                            "version_id": version_id,
                            "process_id": process_id,
                            "code": bp.code,
                            "title": bp.title,
                            "description": bp.text,
                            "sort_order": bp.sort_order,
                        },
                    )

                    base_practice_ids[
                        (process.code, bp.code)
                    ] = bp_id

                for relation in process.work_products:
                    wp_source = source_wp[
                        relation.work_product_code
                    ]

                    wp_id = _one_or_create(
                        db,
                        """
                        SELECT id
                        FROM standard_work_products
                        WHERE standard_version_id = :version_id
                          AND process_id = :process_id
                          AND code = :code
                        """,
                        {
                            "version_id": version_id,
                            "process_id": process_id,
                            "code": wp_source.code,
                        },
                        """
                        INSERT INTO standard_work_products (
                            standard_version_id,
                            process_id,
                            code,
                            title,
                            description,
                            sort_order
                        )
                        VALUES (
                            :version_id,
                            :process_id,
                            :code,
                            :title,
                            :description,
                            :sort_order
                        )
                        RETURNING id
                        """,
                        {
                            "version_id": version_id,
                            "process_id": process_id,
                            "code": wp_source.code,
                            "title": wp_source.name,
                            "description": wp_source.description,
                            "sort_order": relation.sort_order,
                        },
                    )

                    process_wp_ids[
                        (process.code, wp_source.code)
                    ] = wp_id

                    _one_or_create(
                        db,
                        """
                        SELECT id
                        FROM standard_process_work_products
                        WHERE process_id = :process_id
                          AND work_product_id = :work_product_id
                          AND role = :role
                        """,
                        {
                            "process_id": process_id,
                            "work_product_id": wp_id,
                            "role": relation.direction,
                        },
                        """
                        INSERT INTO standard_process_work_products (
                            process_id,
                            work_product_id,
                            role,
                            sort_order
                        )
                        VALUES (
                            :process_id,
                            :work_product_id,
                            :role,
                            :sort_order
                        )
                        RETURNING id
                        """,
                        {
                            "process_id": process_id,
                            "work_product_id": wp_id,
                            "role": relation.direction,
                            "sort_order": relation.sort_order,
                        },
                    )

                for bp in process.base_practices:
                    bp_id = base_practice_ids[
                        (process.code, bp.code)
                    ]

                    for sort_order, wp_code in enumerate(
                        bp.work_product_codes,
                        start=1,
                    ):
                        key = (process.code, wp_code)

                        if key not in process_wp_ids:
                            raise RuntimeError(
                                f"Base practice {bp.code} references "
                                f"work product {wp_code} that is not "
                                f"linked to process {process.code}"
                            )

                        wp_id = process_wp_ids[key]

                        _one_or_create(
                            db,
                            """
                            SELECT id
                            FROM standard_base_practice_work_products
                            WHERE base_practice_id = :base_practice_id
                              AND work_product_id = :work_product_id
                            """,
                            {
                                "base_practice_id": bp_id,
                                "work_product_id": wp_id,
                            },
                            """
                            INSERT INTO standard_base_practice_work_products (
                                base_practice_id,
                                work_product_id,
                                sort_order
                            )
                            VALUES (
                                :base_practice_id,
                                :work_product_id,
                                :sort_order
                            )
                            RETURNING id
                            """,
                            {
                                "base_practice_id": bp_id,
                                "work_product_id": wp_id,
                                "sort_order": sort_order,
                            },
                        )

    for level in source.capability_levels:
        level_id = _one_or_create(
            db,
            """
            SELECT id
            FROM standard_capability_levels
            WHERE standard_id = :standard_id
              AND standard_version_id = :version_id
              AND level = :level
            """,
            {
                "standard_id": standard_id,
                "version_id": version_id,
                "level": level.level,
            },
            """
            INSERT INTO standard_capability_levels (
                standard_id,
                standard_version_id,
                level,
                name,
                description
            )
            VALUES (
                :standard_id,
                :version_id,
                :level,
                :name,
                :description
            )
            RETURNING id
            """,
            {
                "standard_id": standard_id,
                "version_id": version_id,
                "level": level.level,
                "name": level.name,
                "description": level.description,
            },
        )

        for attribute in level.process_attributes:
            _one_or_create(
                db,
                """
                SELECT id
                FROM standard_process_attributes
                WHERE standard_version_id = :version_id
                  AND code = :code
                """,
                {
                    "version_id": version_id,
                    "code": attribute.code,
                },
                """
                INSERT INTO standard_process_attributes (
                    standard_version_id,
                    capability_level_id,
                    code,
                    name,
                    description,
                    sort_order
                )
                VALUES (
                    :version_id,
                    :capability_level_id,
                    :code,
                    :name,
                    :description,
                    :sort_order
                )
                RETURNING id
                """,
                {
                    "version_id": version_id,
                    "capability_level_id": level_id,
                    "code": attribute.code,
                    "name": attribute.name,
                    "description": attribute.description,
                    "sort_order": attribute.sort_order,
                },
            )

    db.flush()

    counts = db.execute(
        text("""
            SELECT
                (
                    SELECT COUNT(*)
                    FROM standard_process_groups
                    WHERE standard_version_id = :version_id
                ) AS process_groups,

                (
                    SELECT COUNT(*)
                    FROM standard_reference_processes
                    WHERE standard_version_id = :version_id
                ) AS processes,

                (
                    SELECT COUNT(*)
                    FROM standard_process_outcomes
                    WHERE standard_version_id = :version_id
                ) AS outcomes,

                (
                    SELECT COUNT(*)
                    FROM standard_base_practices
                    WHERE standard_version_id = :version_id
                ) AS base_practices,

                (
                    SELECT COUNT(*)
                    FROM standard_work_products
                    WHERE standard_version_id = :version_id
                ) AS work_products,

                (
                    SELECT COUNT(*)
                    FROM standard_process_work_products spwp
                    JOIN standard_reference_processes p
                      ON p.id = spwp.process_id
                    WHERE p.standard_version_id = :version_id
                ) AS process_work_products,

                (
                    SELECT COUNT(*)
                    FROM standard_base_practice_work_products bpwp
                    JOIN standard_base_practices bp
                      ON bp.id = bpwp.base_practice_id
                    WHERE bp.standard_version_id = :version_id
                ) AS base_practice_work_products,

                (
                    SELECT COUNT(*)
                    FROM standard_capability_levels
                    WHERE standard_id = :standard_id
                      AND standard_version_id = :version_id
                ) AS capability_levels,

                (
                    SELECT COUNT(*)
                    FROM standard_process_attributes
                    WHERE standard_version_id = :version_id
                ) AS process_attributes
        """),
        {
            "standard_id": standard_id,
            "version_id": version_id,
        },
    ).mappings().one()

    return StandardProjectionResult(
        standard_id=standard_id,
        standard_version_id=version_id,
        process_groups=int(counts["process_groups"]),
        processes=int(counts["processes"]),
        outcomes=int(counts["outcomes"]),
        base_practices=int(counts["base_practices"]),
        work_products=int(counts["work_products"]),
        process_work_products=int(
            counts["process_work_products"]
        ),
        base_practice_work_products=int(
            counts["base_practice_work_products"]
        ),
        capability_levels=int(
            counts["capability_levels"]
        ),
        process_attributes=int(
            counts["process_attributes"]
        ),
    )
