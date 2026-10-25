"""backtest sessions + action log

Revision ID: 0006_backtests
Revises: 0005_playbooks
Create Date: 2026-10-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_backtests"
down_revision: Union[str, None] = "0005_playbooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS = ["backtest_sessions", "backtest_actions"]


def upgrade() -> None:
    op.create_table(
        "backtest_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("asset_type", sa.String(length=16), nullable=False, server_default="stocks"),
        sa.Column("symbol", sa.String(length=24), nullable=False),
        sa.Column("start_balance", sa.Numeric(14, 2), nullable=False, server_default="100000"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("interval", sa.String(length=4), nullable=False, server_default="1m"),
        sa.Column("last_time", sa.BigInteger(), nullable=True),
        sa.Column("visibility", sa.String(length=10), nullable=False, server_default="private"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_bt_sessions_tenant_id", "backtest_sessions", ["tenant_id"])

    op.create_table(
        "backtest_actions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("backtest_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("at_time", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_bt_actions_session_id", "backtest_actions", ["session_id"])
    op.create_index("ix_bt_actions_tenant_id", "backtest_actions", ["tenant_id"])

    for tbl in RLS:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {tbl} "
            f"USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
            f"WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
        )


def downgrade() -> None:
    for tbl in RLS:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {tbl}")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY")
    op.drop_table("backtest_actions")
    op.drop_table("backtest_sessions")