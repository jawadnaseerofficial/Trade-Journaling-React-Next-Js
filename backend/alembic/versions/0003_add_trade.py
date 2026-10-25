"""add accounts executions broker connections

Revision ID: 0003_add_trade
Revises: 0002_auth_tenants
Create Date: 2026-10-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_add_trade"
down_revision: Union[str, None] = "0002_auth_tenants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000001"
DEFAULT_ACCOUNT_ID = "00000000-0000-4000-8000-0000000000a1"


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("broker", sa.String(length=40), nullable=False, server_default="webull"),
        sa.Column("timezone", sa.String(length=60), nullable=False, server_default="US/Eastern"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_accounts_tenant_id", "accounts", ["tenant_id"])

    op.create_table(
        "broker_connections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("broker", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("credentials_encrypted", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_broker_connections_tenant_id", "broker_connections", ["tenant_id"])

    op.add_column("trades", sa.Column("account_id", sa.Uuid(), nullable=True))
    op.add_column("trades", sa.Column("asset_type", sa.String(length=20), nullable=False, server_default="stock"))
    op.create_index("ix_trades_account_id", "trades", ["account_id"])
    op.create_foreign_key("fk_trades_account_id", "trades", "accounts", ["account_id"], ["id"])

    op.create_table(
        "executions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trade_id", sa.Uuid(), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("side", sa.String(length=8), nullable=False),
        sa.Column("qty", sa.Numeric(12, 4), nullable=False),
        sa.Column("price", sa.Numeric(14, 4), nullable=False),
        sa.Column("commission", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("fee", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_executions_trade_id", "executions", ["trade_id"])
    op.create_index("ix_executions_tenant_id", "executions", ["tenant_id"])

    # default account for demo tenant + backfill existing trades
    op.execute(
        f"INSERT INTO accounts (id, tenant_id, name, broker, timezone) "
        f"VALUES ('{DEFAULT_ACCOUNT_ID}', '{DEMO_TENANT_ID}', 'Webull Main PA', 'webull', 'US/Eastern') "
        f"ON CONFLICT DO NOTHING"
    )
    op.execute(f"UPDATE trades SET account_id = '{DEFAULT_ACCOUNT_ID}' WHERE account_id IS NULL")

    for tbl in ("accounts", "executions", "broker_connections"):
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {tbl} "
            f"USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
            f"WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
        )


def downgrade() -> None:
    for tbl in ("accounts", "executions", "broker_connections"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {tbl}")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY")
    op.drop_table("executions")
    op.drop_constraint("fk_trades_account_id", "trades", type_="foreignkey")
    op.drop_index("ix_trades_account_id", table_name="trades")
    op.drop_column("trades", "asset_type")
    op.drop_column("trades", "account_id")
    op.drop_table("broker_connections")
    op.drop_table("accounts")