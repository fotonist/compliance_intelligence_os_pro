"""cleanup duplicate ISO27001 2022 version and enforce canonical uniqueness

Revision ID: 20260902_framework_canonical_cleanup
Revises: 20260902_evidence_review_analytics
Create Date: 2026-09-02
"""

from alembic import op
from sqlalchemy import text


revision = "20260902_framework_canonical_cleanup"
down_revision = "20260902_evidence_review_analytics"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # ---------------------------------------------------------------
    # 1. Resolve the exact duplicate ISO27001 / 2022 versions.
    # ---------------------------------------------------------------
    versions = bind.execute(
        text("""
            SELECT id, status
            FROM standard_versions
            WHERE standard_id = 2
              AND version_code = '2022'
            ORDER BY id
        """)
    ).fetchall()

    if len(versions) != 2:
        raise RuntimeError(
            "Framework cleanup aborted: expected exactly two "
            "ISO27001/2022 standard versions."
        )

    published = [row for row in versions if row.status == "published"]
    drafts = [row for row in versions if row.status == "draft"]

    if len(published) != 1 or len(drafts) != 1:
        raise RuntimeError(
            "Framework cleanup aborted: expected exactly one "
            "published and one draft ISO27001/2022 version."
        )

    canonical_version_id = published[0].id
    duplicate_version_id = drafts[0].id

    if canonical_version_id != 2 or duplicate_version_id != 5:
        raise RuntimeError(
            "Framework cleanup aborted: expected canonical version "
            "ID=2 and duplicate version ID=5."
        )

    # ---------------------------------------------------------------
    # 2. Validate duplicate branch counts before deleting anything.
    # ---------------------------------------------------------------
    clause_count = bind.execute(
        text("""
            SELECT COUNT(*)
            FROM clauses
            WHERE standard_version_id = :version_id
        """),
        {"version_id": duplicate_version_id},
    ).scalar()

    requirement_count = bind.execute(
        text("""
            SELECT COUNT(*)
            FROM requirements req
            JOIN clauses cl ON cl.id = req.clause_id
            WHERE cl.standard_version_id = :version_id
        """),
        {"version_id": duplicate_version_id},
    ).scalar()

    control_count = bind.execute(
        text("""
            SELECT COUNT(*)
            FROM controls
            WHERE standard_version_id = :version_id
        """),
        {"version_id": duplicate_version_id},
    ).scalar()

    if clause_count != 8:
        raise RuntimeError(
            f"Framework cleanup aborted: expected 8 duplicate clauses, "
            f"found {clause_count}."
        )

    if requirement_count != 116:
        raise RuntimeError(
            f"Framework cleanup aborted: expected 116 duplicate requirements, "
            f"found {requirement_count}."
        )

    if control_count != 93:
        raise RuntimeError(
            f"Framework cleanup aborted: expected 93 duplicate controls, "
            f"found {control_count}."
        )

    # ---------------------------------------------------------------
    # 3. Hard dependency safety checks.
    #
    # The duplicate branch must not have operational references other
    # than the already identified Risk 44 mapping.
    # ---------------------------------------------------------------
    dependency_checks = {
        "requirement_evidences": """
            SELECT COUNT(*)
            FROM evidences e
            JOIN requirements r ON r.id = e.requirement_id
            JOIN clauses c ON c.id = r.clause_id
            WHERE c.standard_version_id = :version_id
        """,
        "requirement_matrix_rows": """
            SELECT COUNT(*)
            FROM matrix_rows mr
            JOIN requirements r ON r.id = mr.requirement_id
            JOIN clauses c ON c.id = r.clause_id
            WHERE c.standard_version_id = :version_id
        """,
        "requirement_risks": """
            SELECT COUNT(*)
            FROM risks rsk
            JOIN requirements r ON r.id = rsk.requirement_id
            JOIN clauses c ON c.id = r.clause_id
            WHERE c.standard_version_id = :version_id
        """,
        "control_evidences": """
            SELECT COUNT(*)
            FROM evidences e
            JOIN controls c ON c.id = e.control_id
            WHERE c.standard_version_id = :version_id
        """,
        "control_tasks": """
            SELECT COUNT(*)
            FROM compliance_tasks t
            JOIN controls c ON c.id = t.control_id
            WHERE c.standard_version_id = :version_id
        """,
        "control_risks": """
            SELECT COUNT(*)
            FROM risks rsk
            JOIN controls c ON c.id = rsk.control_id
            WHERE c.standard_version_id = :version_id
        """,
        "control_matrix_rows": """
            SELECT COUNT(*)
            FROM matrix_rows mr
            JOIN controls c ON c.id = mr.control_id
            WHERE c.standard_version_id = :version_id
        """,
        "control_decisions": """
            SELECT COUNT(*)
            FROM decision_register_controls drc
            JOIN controls c ON c.id = drc.control_id
            WHERE c.standard_version_id = :version_id
        """,
        "control_governance_procedures": """
            SELECT COUNT(*)
            FROM governance_procedure_controls gpc
            JOIN controls c ON c.id = gpc.control_id
            WHERE c.standard_version_id = :version_id
        """,
        "clause_weight_overrides": """
            SELECT COUNT(*)
            FROM clause_weight_overrides cwo
            JOIN clauses c ON c.id = cwo.clause_id
            WHERE c.standard_version_id = :version_id
        """,
    }

    dependency_counts = {}

    for name, sql in dependency_checks.items():
        count = bind.execute(
            text(sql),
            {"version_id": duplicate_version_id},
        ).scalar()

        dependency_counts[name] = int(count or 0)

    allowed = {
        "requirement_risks": 1,
        "control_risks": 1,
    }

    for name, count in dependency_counts.items():
        expected = allowed.get(name, 0)

        if count != expected:
            raise RuntimeError(
                f"Framework cleanup aborted: unexpected dependency "
                f"{name}={count}; expected {expected}."
            )

    # ---------------------------------------------------------------
    # 4. The only expected operational reference is Risk 44.
    # ---------------------------------------------------------------
    risk_refs = bind.execute(
        text("""
            SELECT DISTINCT
                rsk.id,
                rsk.requirement_id,
                rsk.control_id
            FROM risks rsk
            LEFT JOIN requirements req
                ON req.id = rsk.requirement_id
            LEFT JOIN clauses cl
                ON cl.id = req.clause_id
            LEFT JOIN controls ctrl
                ON ctrl.id = rsk.control_id
            WHERE
                cl.standard_version_id = :duplicate_version_id
                OR ctrl.standard_version_id = :duplicate_version_id
            ORDER BY rsk.id
        """),
        {"duplicate_version_id": duplicate_version_id},
    ).fetchall()

    if len(risk_refs) != 1 or risk_refs[0].id != 44:
        raise RuntimeError(
            "Framework cleanup aborted: expected exactly Risk 44 "
            "as the duplicate-version operational reference."
        )

    # ---------------------------------------------------------------
    # 5. Resolve Risk 44 references by business code.
    # ---------------------------------------------------------------
    risk_id, duplicate_requirement_id, duplicate_control_id = risk_refs[0]

    canonical_requirement_id = None
    canonical_control_id = None

    if duplicate_requirement_id is not None:
        requirement = bind.execute(
            text("""
                SELECT req.code
                FROM requirements req
                JOIN clauses cl ON cl.id = req.clause_id
                WHERE req.id = :requirement_id
                  AND cl.standard_version_id = :duplicate_version_id
            """),
            {
                "requirement_id": duplicate_requirement_id,
                "duplicate_version_id": duplicate_version_id,
            },
        ).fetchone()

        if requirement is None:
            raise RuntimeError(
                "Framework cleanup aborted: Risk 44 duplicate "
                "requirement reference is invalid."
            )

        canonical_requirement = bind.execute(
            text("""
                SELECT req.id
                FROM requirements req
                JOIN clauses cl ON cl.id = req.clause_id
                WHERE cl.standard_version_id = :canonical_version_id
                  AND req.code = :code
            """),
            {
                "canonical_version_id": canonical_version_id,
                "code": requirement.code,
            },
        ).fetchone()

        if canonical_requirement is None:
            raise RuntimeError(
                f"Framework cleanup aborted: no canonical requirement "
                f"found for code {requirement.code!r}."
            )

        canonical_requirement_id = canonical_requirement.id

    if duplicate_control_id is not None:
        control = bind.execute(
            text("""
                SELECT code
                FROM controls
                WHERE id = :control_id
                  AND standard_version_id = :duplicate_version_id
            """),
            {
                "control_id": duplicate_control_id,
                "duplicate_version_id": duplicate_version_id,
            },
        ).fetchone()

        if control is None:
            raise RuntimeError(
                "Framework cleanup aborted: Risk 44 duplicate "
                "control reference is invalid."
            )

        canonical_control = bind.execute(
            text("""
                SELECT id
                FROM controls
                WHERE standard_version_id = :canonical_version_id
                  AND code = :code
            """),
            {
                "canonical_version_id": canonical_version_id,
                "code": control.code,
            },
        ).fetchone()

        if canonical_control is None:
            raise RuntimeError(
                f"Framework cleanup aborted: no canonical control "
                f"found for code {control.code!r}."
            )

        canonical_control_id = canonical_control.id

    bind.execute(
        text("""
            UPDATE risks
            SET
                requirement_id = COALESCE(
                    :canonical_requirement_id,
                    requirement_id
                ),
                control_id = COALESCE(
                    :canonical_control_id,
                    control_id
                )
            WHERE id = :risk_id
        """),
        {
            "risk_id": risk_id,
            "canonical_requirement_id": canonical_requirement_id,
            "canonical_control_id": canonical_control_id,
        },
    )

    # ---------------------------------------------------------------
    # 6. Verify Risk 44 is now fully canonical BEFORE deletes.
    # ---------------------------------------------------------------
    verify = bind.execute(
        text("""
            SELECT
                rsk.requirement_id,
                rsk.control_id
            FROM risks rsk
            WHERE rsk.id = :risk_id
        """),
        {"risk_id": risk_id},
    ).fetchone()

    if verify is None:
        raise RuntimeError(
            "Framework cleanup aborted: Risk 44 disappeared unexpectedly."
        )

    if verify.requirement_id != canonical_requirement_id:
        raise RuntimeError(
            "Framework cleanup aborted: Risk 44 requirement remap failed."
        )

    if verify.control_id != canonical_control_id:
        raise RuntimeError(
            "Framework cleanup aborted: Risk 44 control remap failed."
        )

    # ---------------------------------------------------------------
    # 7. Delete duplicate branch.
    # ---------------------------------------------------------------
    bind.execute(
        text("""
            DELETE FROM controls
            WHERE standard_version_id = :version_id
        """),
        {"version_id": duplicate_version_id},
    )

    bind.execute(
        text("""
            DELETE FROM requirements req
            USING clauses cl
            WHERE req.clause_id = cl.id
              AND cl.standard_version_id = :version_id
        """),
        {"version_id": duplicate_version_id},
    )

    bind.execute(
        text("""
            DELETE FROM clauses
            WHERE standard_version_id = :version_id
        """),
        {"version_id": duplicate_version_id},
    )

    deleted_version = bind.execute(
        text("""
            DELETE FROM standard_versions
            WHERE id = :version_id
              AND standard_id = 2
              AND version_code = '2022'
              AND status = 'draft'
        """),
        {"version_id": duplicate_version_id},
    )

    if deleted_version.rowcount != 1:
        raise RuntimeError(
            "Framework cleanup aborted: duplicate standard version "
            "was not deleted exactly once."
        )

    # ---------------------------------------------------------------
    # 8. Enforce canonical business-key uniqueness.
    # ---------------------------------------------------------------
    op.create_unique_constraint(
        "uq_standards_code",
        "standards",
        ["code"],
    )

    op.create_unique_constraint(
        "uq_standard_version_code",
        "standard_versions",
        ["standard_id", "version_code"],
    )

    op.create_unique_constraint(
        "uq_clause_version_code",
        "clauses",
        ["standard_version_id", "code"],
    )

    op.create_unique_constraint(
        "uq_requirement_clause_code",
        "requirements",
        ["clause_id", "code"],
    )

    op.create_unique_constraint(
        "uq_control_version_code",
        "controls",
        ["standard_version_id", "code"],
    )


def downgrade():
    raise RuntimeError(
        "Framework canonical cleanup is intentionally irreversible. "
        "Restore the pre-migration database backup instead of running "
        "an automatic downgrade."
    )
