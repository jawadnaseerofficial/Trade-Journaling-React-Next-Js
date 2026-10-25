"""playbooks rules marks missed notes shares

Revision ID: 0005_playbooks
Revises: 0004_journal_replay
Create Date: 2026-10-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_playbooks"
down_revision: Union[str, None] = "0004_journal_replay"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = ["playbooks", "playbook_rule_groups", "playbook_rules", "trade_rule_marks",
              "missed_trades", "playbook_notes", "playbook_shares"]


def upgrade() -> None:
    op.create_table(
        "playbooks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=16), nullable=False, server_default=""),
        sa.Column("color", sa.String(length=9), nullable=False, server_default="#6D5DE7"),
        sa.Column("visibility", sa.String(length=10), nullable=False, server_default="private"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_playbooks_tenant_id", "playbooks", ["tenant_id"])

    op.create_table(
        "playbook_rule_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_pb_groups_playbook_id", "playbook_rule_groups", ["playbook_id"])
    op.create_index("ix_pb_groups_tenant_id", "playbook_rule_groups", ["tenant_id"])

    op.create_table(
        "playbook_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("group_id", sa.Uuid(), sa.ForeignKey("playbook_rule_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("visibility", sa.String(length=12), nullable=False, server_default="always"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_pb_rules_group_id", "playbook_rules", ["group_id"])
    op.create_index("ix_pb_rules_playbook_id", "playbook_rules", ["playbook_id"])
    op.create_index("ix_pb_rules_tenant_id", "playbook_rules", ["tenant_id"])

    op.create_table(
        "trade_rule_marks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trade_id", sa.Uuid(), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", sa.Uuid(), sa.ForeignKey("playbook_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("followed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("trade_id", "rule_id", name="uq_marks_trade_rule"),
    )
    op.create_index("ix_marks_trade_id", "trade_rule_marks", ["trade_id"])
    op.create_index("ix_marks_rule_id", "trade_rule_marks", ["rule_id"])
    op.create_index("ix_marks_tenant_id", "trade_rule_marks", ["tenant_id"])

    op.create_table(
        "missed_trades",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("side", sa.String(length=8), nullable=False, server_default="buy"),
        sa.Column("qty", sa.Numeric(12, 4), nullable=False, server_default="1"),
        sa.Column("open_date", sa.Date(), nullable=False),
        sa.Column("close_date", sa.Date(), nullable=False),
        sa.Column("entry_price", sa.Numeric(14, 4), nullable=False),
        sa.Column("exit_price", sa.Numeric(14, 4), nullable=False),
        sa.Column("net_pnl", sa.Numeric(12, 2), nullable=False),
        sa.Column("net_roi", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="win"),
        sa.Column("setups", sa.Text(), nullable=True),
    )
    op.create_index("ix_missed_playbook_id", "missed_trades", ["playbook_id"])
    op.create_index("ix_missed_tenant_id", "missed_trades", ["tenant_id"])

    op.create_table(
        "playbook_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, server_default="Untitled"),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_pbnotes_playbook_id", "playbook_notes", ["playbook_id"])
    op.create_index("ix_pbnotes_tenant_id", "playbook_notes", ["tenant_id"])

    op.create_table(
        "playbook_shares",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("playbook_id", "user_id", name="uq_share_playbook_user"),
    )
    op.create_index("ix_shares_tenant_id", "playbook_shares", ["tenant_id"])

    op.add_column("trades", sa.Column("playbook_id", sa.Uuid(), nullable=True))
    op.create_index("ix_trades_playbook_id", "trades", ["playbook_id"])
    op.create_foreign_key("fk_trades_playbook_id", "trades", "playbooks", ["playbook_id"], ["id"])

    for tbl in RLS_TABLES:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {tbl} "
            f"USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
            f"WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
        )


def downgrade() -> None:
    for tbl in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {tbl}")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY")
    op.drop_constraint("fk_trades_playbook_id", "trades", type_="foreignkey")
    op.drop_index("ix_trades_playbook_id", table_name="trades")
    op.drop_column("trades", "playbook_id")
    for tbl in ["playbook_shares", "playbook_notes", "missed_trades", "trade_rule_marks",
                "playbook_rules", "playbook_rule_groups", "playbooks"]:
        op.drop_table(tbl)