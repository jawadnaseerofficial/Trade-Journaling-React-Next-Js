"""journal replay annotations

Revision ID: 0004_journal_replay
Revises: 0003_add_trade
Create Date: 2026-10-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_journal_replay"
down_revision: Union[str, None] = "0003_add_trade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("chart_style", sa.String(length=20), nullable=False, server_default="lightweight"))

    op.add_column("trades", sa.Column("instrument", sa.String(length=64), nullable=True))
    op.add_column("trades", sa.Column("note", sa.Text(), nullable=True))
    op.add_column("trades", sa.Column("rating", sa.Integer(), nullable=True))
    op.add_column("trades", sa.Column("playbook", sa.String(length=120), nullable=True))
    op.add_column("trades", sa.Column("tags", sa.Text(), nullable=True))
    op.add_column("trades", sa.Column("setups", sa.Text(), nullable=True))
    op.add_column("trades", sa.Column("mistakes", sa.Text(), nullable=True))
    op.add_column("trades", sa.Column("custom_tags", sa.Text(), nullable=True))
    op.add_column("trades", sa.Column("profit_target", sa.Numeric(14, 4), nullable=True))
    op.add_column("trades", sa.Column("stop_loss", sa.Numeric(14, 4), nullable=True))
    op.add_column("trades", sa.Column("initial_target", sa.Numeric(14, 4), nullable=True))
    op.add_column("trades", sa.Column("planned_r", sa.Numeric(10, 4), nullable=True))

    op.create_table(
        "journal_days",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "day", name="uq_journal_days_tenant_day"),
    )
    op.create_index("ix_journal_days_tenant_id", "journal_days", ["tenant_id"])

    op.execute("ALTER TABLE journal_days ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE journal_days FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON journal_days "
        "USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
        "WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON journal_days")
    op.execute("ALTER TABLE journal_days NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE journal_days DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_journal_days_tenant_id", table_name="journal_days")
    op.drop_table("journal_days")
    for col in ("planned_r", "initial_target", "stop_loss", "profit_target",
                "custom_tags", "mistakes", "setups", "tags", "playbook",
                "rating", "note", "instrument"):
        op.drop_column("trades", col)
    op.drop_column("users", "chart_style")