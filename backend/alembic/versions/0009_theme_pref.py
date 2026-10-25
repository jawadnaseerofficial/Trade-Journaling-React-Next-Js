"""theme preference

Revision ID: 0009_theme_pref
Revises: 0008_settings_profile
Create Date: 2026-10-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_theme_pref"
down_revision: Union[str, None] = "0008_settings_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # additive + defaulted ONLY -> zero effect on any existing query/aggregate
    op.add_column("users", sa.Column("theme_pref", sa.String(length=16), nullable=False, server_default="system"))


def downgrade() -> None:
    op.drop_column("users", "theme_pref")