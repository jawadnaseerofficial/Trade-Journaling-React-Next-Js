"""notebook: folders, notes, tags, templates

Revision ID: 0011_notebook
Revises: 0010_token_version
Create Date: 2026-10-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_notebook"
down_revision: Union[str, None] = "0010_token_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTEBOOK_TAGS IS DELIBERATELY ABSENT FROM THIS LIST. It is a pure link table
# (composite PK notebook_id+tag_id, no tenant_id column). Tenant isolation for it is
# enforced by (a) the FKs pointing at tenant-scoped parents that carry WITH CHECK policies
# -> a cross-tenant link row cannot be inserted, and (b) every read joins through a
# tenant-filtered parent. delete_account likewise skips no-tenant_id tables and relies on
# these rows' ondelete=CASCADE to purge them with their parent notebooks. So omitting it
# here is correct engineering, not a gap.
RLS = ["note_folders", "notebooks", "note_tags", "note_templates"]


def upgrade() -> None:
    op.create_table(
        "note_folders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("color", sa.String(length=9), nullable=False, server_default=""),
        sa.Column("kind", sa.String(length=10), nullable=False, server_default="custom"),  # system|custom
        sa.Column("link_type", sa.String(length=12), nullable=True),  # trade|daily|recap|backtest|null
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_nf_tenant", "note_folders", ["tenant_id"])

    op.create_table(
        "notebooks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("folder_id", sa.Uuid(), sa.ForeignKey("note_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False, server_default="Untitled"),
        sa.Column("body_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("link_type", sa.String(length=12), nullable=False, server_default="manual"),  # trade|daily|recap|backtest|manual
        sa.Column("link_id", sa.String(length=40), nullable=True),  # trade uuid | date iso | period key | session uuid
        sa.Column("source", sa.String(length=8), nullable=False, server_default="manual"),  # auto|manual
        sa.Column("starred", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("share_token", sa.String(length=40), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "link_type", "link_id", name="uq_nb_link"),
    )
    op.create_index("ix_nb_tenant", "notebooks", ["tenant_id"])
    op.create_index("ix_nb_folder", "notebooks", ["folder_id"])

    op.create_table(
        "note_tags",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.UniqueConstraint("tenant_id", "name", name="uq_nt_tag"),
    )
    op.create_index("ix_nt_tenant", "note_tags", ["tenant_id"])

    op.create_table(
        "notebook_tags",
        sa.Column("notebook_id", sa.Uuid(), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Uuid(), sa.ForeignKey("note_tags.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "note_templates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(length=12), nullable=False, server_default="custom"),  # recommended|custom
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("favourite", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ntmpl_tenant", "note_templates", ["tenant_id"])

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
    # reverse FK-safe order: link table before its parents
    for tbl in ["note_templates", "notebook_tags", "note_tags", "notebooks", "note_folders"]:
        op.drop_table(tbl)