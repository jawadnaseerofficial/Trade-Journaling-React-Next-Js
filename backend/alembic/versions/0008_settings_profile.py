"""settings profile fields

Revision ID: 0008_settings_profile
Revises: 0007_backtest_shares
Create Date: 2026-10-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_settings_profile"
down_revision: Union[str, None] = "0007_backtest_shares"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # additive + nullable/defaulted ONLY -> zero effect on any existing aggregate or query
    op.add_column("users", sa.Column("display_name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("avatar", sa.String(length=16), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("users", "avatar")
    op.drop_column("users", "display_name")