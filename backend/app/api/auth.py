import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import EmailTakenError, InvalidCredentialsError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import Account, Tenant, User
from app.db.session import get_session
from app.schemas.auth import AuthIn, TokenOut, UserOut

router = APIRouter(prefix="/auth")


def _user_out(user: User) -> UserOut:
    return UserOut(id=str(user.id), email=user.email, tenant_id=str(user.tenant_id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    """Cheap 'is my cookie still valid?' check. 200 = good, 401 = clear it."""
    return _user_out(user)


@router.post("/register", response_model=TokenOut, status_code=201)
async def register(body: AuthIn, session: AsyncSession = Depends(get_session)):
    existing = (await session.execute(select(User.id).where(User.email == body.email.lower()))).first()
    if existing:
        raise EmailTakenError("An account with this email already exists")

    tenant = Tenant(name="My Journal")
    session.add(tenant)
    await session.flush()

    session.add(Account(tenant_id=tenant.id, name="Main Account", broker="webull", timezone="US/Eastern"))

    user = User(
        tenant_id=tenant.id,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
    )
    session.add(user)
    await session.commit()

    return TokenOut(access_token=create_access_token(str(user.id), str(tenant.id)), user=_user_out(user))


@router.post("/login", response_model=TokenOut)
async def login(body: AuthIn, session: AsyncSession = Depends(get_session)):
    user = (await session.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise InvalidCredentialsError("Incorrect email or password")
    return TokenOut(access_token=create_access_token(str(user.id), str(user.tenant_id)), user=_user_out(user))