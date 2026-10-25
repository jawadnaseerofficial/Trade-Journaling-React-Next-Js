"""auth tenants users rls

Revision ID: 0002_auth_tenants
Revises: 34a1fba48dff
Create Date: 2026-10-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_auth_tenants"
down_revision: Union[str, None] = "34a1fba48dff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000001"


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.add_column("trades", sa.Column("tenant_id", sa.Uuid(), nullable=True))
    op.execute(f"UPDATE trades SET tenant_id = '{DEMO_TENANT_ID}' WHERE tenant_id IS NULL")
    op.execute(f"INSERT INTO tenants (id, name) VALUES ('{DEMO_TENANT_ID}', 'Demo Tenant') ON CONFLICT DO NOTHING")
    op.alter_column("trades", "tenant_id", nullable=False)
    op.create_index("ix_trades_tenant_id", "trades", ["tenant_id"])
    op.create_foreign_key("fk_trades_tenant_id", "trades", "tenants", ["tenant_id"], ["id"])

    op.execute("ALTER TABLE trades ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE trades FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON trades "
        "USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
        "WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON trades")
    op.execute("ALTER TABLE trades NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE trades DISABLE ROW LEVEL SECURITY")
    op.drop_constraint("fk_trades_tenant_id", "trades", type_="foreignkey")
    op.drop_index("ix_trades_tenant_id", table_name="trades")
    op.drop_column("trades", "tenant_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_tenant_id", table_name="users")
    op.drop_table("users")
    op.drop_table("tenants")