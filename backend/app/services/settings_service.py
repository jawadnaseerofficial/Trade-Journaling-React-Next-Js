from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError, EmailTakenError, NotFoundError
from app.db.models import Base, Tenant, User

_ALLOWED_CHART = ("lightweight", "candles", "simple")
_ALLOWED_THEME = ("light", "dark", "system")


async def get_profile(session: AsyncSession, user: User) -> dict:
    tenant = await session.get(Tenant, user.tenant_id)
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "avatar": user.avatar or "",
        "chart_style": user.chart_style or "lightweight",
        "theme_pref": user.theme_pref or "system",
        "tenant_name": tenant.name if tenant else "",
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }


async def update_profile(session: AsyncSession, user: User, body) -> dict:
    if body.display_name is not None:
        user.display_name = body.display_name.strip()[:120] or None
    if body.avatar is not None:
        user.avatar = body.avatar.strip()[:16]
    if body.chart_style is not None:
        if body.chart_style not in _ALLOWED_CHART:
            raise DomainError(f"chart_style must be one of {', '.join(_ALLOWED_CHART)}")
        user.chart_style = body.chart_style
    if body.theme_pref is not None:
        if body.theme_pref not in _ALLOWED_THEME:
            raise DomainError(f"theme_pref must be one of {', '.join(_ALLOWED_THEME)}")
        user.theme_pref = body.theme_pref
    await session.commit()
    return await get_profile(session, user)


async def change_email(session: AsyncSession, user: User, email: str) -> dict:
    email = (email or "").strip()
    if not email or "@" not in email:
        raise DomainError("Enter a valid email address")
    clash = (await session.execute(
        select(User).where(func.lower(User.email) == email.lower(), User.id != user.id)
    )).scalar_one_or_none()
    if clash is not None:
        raise EmailTakenError("That email is already registered")
    user.email = email
    await session.commit()
    return await get_profile(session, user)


async def update_tenant(session: AsyncSession, user: User, name: str) -> dict:
    name = (name or "").strip()
    if not name:
        raise DomainError("Workspace name is required")
    tenant = await session.get(Tenant, user.tenant_id)
    if tenant is None:
        raise NotFoundError("Workspace not found")
    tenant.name = name[:120]
    await session.commit()
    return {"name": tenant.name}


async def change_password(session: AsyncSession, user: User, current: str, new: str) -> dict:
    if not new or len(new) < 8:
        raise DomainError("New password must be at least 8 characters")
    hash_password = verify_password = None
    for hp, vp in (("hash_password", "verify_password"),
                   ("get_password_hash", "verify_password"),
                   ("hash_password", "check_password")):
        try:
            mod = __import__("app.core.security", fromlist=[hp, vp])
            hash_password, verify_password = getattr(mod, hp), getattr(mod, vp)
            break
        except Exception:
            continue
    if hash_password is None or verify_password is None:
        raise DomainError(
            "Could not locate password helpers in app.core.security "
            "(tried hash_password/verify_password, get_password_hash, check_password). "
            "Paste that file and I'll wire it exactly."
        )
    if not verify_password(current, user.password_hash):
        raise DomainError("Current password is incorrect")
    user.password_hash = hash_password(new)
    await session.commit()
    return {"ok": True}


async def logout_everywhere(session: AsyncSession, user: User) -> dict:
    # Bump the version; the deps.py check (presence-gated on the `ver` claim) then rejects every
    # older token that carries a version. Tokens minted before login embeds `ver` are unaffected
    # (no claim -> skipped), which is what keeps this loop-safe. See auth.py note in the message.
    user.token_version = (user.token_version or 0) + 1
    await session.commit()
    return {"ok": True, "token_version": user.token_version}


async def delete_account(session: AsyncSession, user: User) -> dict:
    """Hard delete. Metadata-driven so it covers EVERY tenant-scoped table (incl. ones I've never
    seen) in child-before-parent order -> no FK can block it, nothing is missed.
    - Sole member of the workspace -> purge the whole tenant (all data) + the tenant row.
    - Shared workspace -> delete only this user's row (their share rows cascade); teammates' data stays.
    """
    tid = user.tenant_id
    others = (await session.execute(
        select(func.count()).select_from(User).where(User.tenant_id == tid, User.id != user.id)
    )).scalar() or 0
    try:
        if others == 0:
            for t in reversed(Base.metadata.sorted_tables):   # children before parents
                if t.name == "tenants" or "tenant_id" not in t.c:
                    continue
                await session.execute(
                    text(f'DELETE FROM "{t.name}" WHERE tenant_id = :tid'), {"tid": str(tid)}
                )
            await session.execute(text("DELETE FROM tenants WHERE id = :tid"), {"tid": str(tid)})
            await session.commit()
            return {"mode": "workspace"}
        else:
            await session.delete(user)                          # share rows (user_id FK) cascade
            await session.commit()
            return {"mode": "user"}
    except SQLAlchemyError as e:
        await session.rollback()
        raise DomainError("Account deletion was rolled back — a related record blocked it. "
                          f"Details: {type(e).__name__}")