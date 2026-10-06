"""fix maturity evidence workspace session fk

Revision ID: 63b72b509177
Revises: gap_task_target_20261003221430
Create Date: 2026-10-05 11:34:55.341809
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '63b72b509177'
down_revision = 'gap_task_target_20261003221430'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    foreign_keys = inspector.get_foreign_keys(
        "maturity_evidences"
    )

    session_fk = None

    for fk in foreign_keys:
        if fk.get("constrained_columns") == ["session_id"]:
            session_fk = fk
            break

    if session_fk is None:
        raise RuntimeError(
            "maturity_evidences.session_id FK not found"
        )

    referred_table = session_fk.get("referred_table")

    if referred_table == "maturity_workspace_sessions":
        return

    if referred_table != "maturity_assessment_sessions":
        raise RuntimeError(
            "Unexpected maturity_evidences.session_id FK target: "
            + str(referred_table)
        )

    constraint_name = session_fk.get("name")

    if not constraint_name:
        raise RuntimeError(
            "Existing session_id FK has no constraint name"
        )

    op.drop_constraint(
        constraint_name,
        "maturity_evidences",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_maturity_evidences_session_workspace",
        "maturity_evidences",
        "maturity_workspace_sessions",
        ["session_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    foreign_keys = inspector.get_foreign_keys(
        "maturity_evidences"
    )

    for fk in foreign_keys:
        if (
            fk.get("constrained_columns") == ["session_id"]
            and fk.get("referred_table")
            == "maturity_workspace_sessions"
        ):
            constraint_name = fk.get("name")

            if constraint_name:
                op.drop_constraint(
                    constraint_name,
                    "maturity_evidences",
                    type_="foreignkey",
                )

            break

    op.create_foreign_key(
        "fk_maturity_evidences_session_assessment",
        "maturity_evidences",
        "maturity_assessment_sessions",
        ["session_id"],
        ["id"],
        ondelete="CASCADE",
    )
