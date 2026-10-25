import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.core.tenant import set_tenant
from app.db.models import User
from app.db.session import get_session

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    if creds is None:
        raise UnauthorizedError("Not authenticated")

    payload = decode_access_token(creds.credentials)
    user = await session.get(User, uuid.UUID(payload["sub"]))
    # Guard FIRST: a deleted/stale sub must yield a clean 401 (which the client auto-redirects on),
    # never a 500 from dereferencing user.token_version below on a None user.
    if user is None:
        raise UnauthorizedError("User not found")
    # presence-gated revocation: only tokens that carry a `ver` claim are version-checked, so a
    # login that hasn't embedded `ver` yet can never be loop-rejected. UnauthorizedError is already
    # imported at the top, so this introduces no new import.
    _ver = payload.get("ver")
    if _ver is not None and int(_ver) != (user.token_version or 0):
        raise UnauthorizedError("Session revoked — please sign in again")

    set_tenant(str(user.tenant_id))
    await session.execute(
        text("SELECT set_config('app.tenant_id', :tid, true)"),
        {"tid": str(user.tenant_id)},
    )
    return user