from contextvars import ContextVar

tenant_ctx: ContextVar[str | None] = ContextVar("tenant_id", default=None)


def set_tenant(tenant_id: str | None) -> None:
    tenant_ctx.set(tenant_id)


def get_tenant() -> str | None:
    return tenant_ctx.get()