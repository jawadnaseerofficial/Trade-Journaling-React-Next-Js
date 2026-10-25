"""token version (for revoke-everywhere)

Revision ID: 0010_token_version
Revises: 0009_theme_pref
Create Date: 2026-10-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_token_version"
down_revision: Union[str, None] = "0009_theme_pref"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # additive + defaulted ONLY -> existing tokens (no ver claim) still validate; see deps note.
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "token_version")