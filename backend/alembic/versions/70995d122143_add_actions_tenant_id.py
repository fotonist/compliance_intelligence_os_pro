"""add actions tenant id

Revision ID: 70995d122143
Revises: 63b72b509177
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "70995d122143"
down_revision: Union[str, Sequence[str], None] = "63b72b509177"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "actions",
        sa.Column(
            "tenant_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_actions_tenant_id",
        "actions",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # Existing rows are backfilled only when their tenant can be
    # derived unambiguously from tenant-scoped related records.
    op.execute(
        """
        UPDATE actions AS a
        SET tenant_id = u.tenant_id
        FROM users AS u
        WHERE a.tenant_id IS NULL
          AND a.user_id = u.id
        """
    )

    op.execute(
        """
        UPDATE actions AS a
        SET tenant_id = u.tenant_id
        FROM users AS u
        WHERE a.tenant_id IS NULL
          AND a.assigned_to_user_id = u.id
        """
    )

    op.execute(
        """
        UPDATE actions AS a
        SET tenant_id = u.tenant_id
        FROM users AS u
        WHERE a.tenant_id IS NULL
          AND a.created_by_user_id = u.id
        """
    )

    op.execute(
        """
        UPDATE actions AS a
        SET tenant_id = r.tenant_id
        FROM risks AS r
        WHERE a.tenant_id IS NULL
          AND a.risk_id = r.id
        """
    )

    bind = op.get_bind()

    unresolved = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM actions
            WHERE tenant_id IS NULL
            """
        )
    ).scalar_one()

    if unresolved:
        raise RuntimeError(
            "Cannot migrate actions.tenant_id: "
            f"{unresolved} action row(s) have no deterministic tenant."
        )

    conflicts = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM actions AS a
            LEFT JOIN users AS owner_u
              ON owner_u.id = a.user_id
            LEFT JOIN users AS assigned_u
              ON assigned_u.id = a.assigned_to_user_id
            LEFT JOIN users AS creator_u
              ON creator_u.id = a.created_by_user_id
            LEFT JOIN risks AS r
              ON r.id = a.risk_id
            WHERE
                (
                    owner_u.tenant_id IS NOT NULL
                    AND owner_u.tenant_id <> a.tenant_id
                )
                OR
                (
                    assigned_u.tenant_id IS NOT NULL
                    AND assigned_u.tenant_id <> a.tenant_id
                )
                OR
                (
                    creator_u.tenant_id IS NOT NULL
                    AND creator_u.tenant_id <> a.tenant_id
                )
                OR
                (
                    r.tenant_id IS NOT NULL
                    AND r.tenant_id <> a.tenant_id
                )
            """
        )
    ).scalar_one()

    if conflicts:
        raise RuntimeError(
            "Cannot migrate actions.tenant_id: "
            f"{conflicts} action row(s) contain cross-tenant relationships."
        )

    op.alter_column(
        "actions",
        "tenant_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.create_index(
        "ix_actions_tenant_id",
        "actions",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_actions_tenant_id",
        table_name="actions",
    )

    op.drop_constraint(
        "fk_actions_tenant_id",
        "actions",
        type_="foreignkey",
    )

    op.drop_column(
        "actions",
        "tenant_id",
    )
