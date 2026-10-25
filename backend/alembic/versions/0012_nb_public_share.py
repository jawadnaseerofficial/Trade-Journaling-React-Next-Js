"""notebook public share (rls read clause)

Revision ID: 0012_nb_public_share
Revises: 0011_notebook
Create Date: 2026-10-25

Why: notebooks carries FORCE ROW LEVEL SECURITY with policy USING (tenant_id = current_setting(...)).
The public share-link endpoint is UNAUTHENTICATED, so app.tenant_id is unset -> current_setting is
NULL -> tenant_id = NULL is false -> even an intentionally-shared note is hidden from its own public
URL. Widen ONLY the read (USING) clause to also admit rows that bear a share_token (an unguessable
24-hex token, set exclusively by the authenticated owner via toggle_share). The write (WITH CHECK)
clause stays strictly tenant-bound, and every authenticated query still applies its own
`where tenant_id == :tid`, so an authenticated user cannot read or mutate another tenant's shared
note through this clause (verified: detail/patch/set_tags/soft_delete/restore/purge/toggle_share all
re-check nb.tenant_id after fetch). Net effect: a share link becomes world-readable by token, exactly
as designed; nothing else changes.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0012_nb_public_share"
down_revision: Union[str, None] = "0011_notebook"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON notebooks")
    op.execute(
        "CREATE POLICY tenant_isolation ON notebooks "
        "USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR share_token IS NOT NULL) "
        "WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON notebooks")
    op.execute(
        "CREATE POLICY tenant_isolation ON notebooks "
        "USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
        "WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )