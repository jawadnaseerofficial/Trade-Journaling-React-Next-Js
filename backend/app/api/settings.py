from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.settings import EmailPatch, PasswordPatch, ProfileOut, ProfilePatch, TenantPatch
from app.services import settings_service as svc

router = APIRouter(prefix="/settings")


@router.get("/profile", response_model=ProfileOut)
async def get_profile(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.get_profile(session, user)


@router.patch("/profile", response_model=ProfileOut)
async def patch_profile(body: ProfilePatch, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.update_profile(session, user, body)


@router.patch("/email", response_model=ProfileOut)
async def patch_email(body: EmailPatch, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.change_email(session, user, body.email)


@router.patch("/tenant")
async def patch_tenant(body: TenantPatch, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.update_tenant(session, user, body.name)


@router.post("/change-password")
async def change_password(body: PasswordPatch, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.change_password(session, user, body.current_password, body.new_password)


@router.post("/logout-everywhere")
async def logout_everywhere(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.logout_everywhere(session, user)


@router.delete("/account")
async def delete_account(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.delete_account(session, user)