import uuid

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.notebook import (
    FolderCreateIn, FolderPatchIn, NoteCreateIn, NotePatchIn, TagSetIn, TemplateCreateIn, TemplatePatchIn,
)
from app.services import notebook_service as svc

router = APIRouter(prefix="/notebook")


@router.get("/tree")
async def tree(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.tree(session, user.tenant_id)


@router.get("/notes")
async def notes(folder: str = Query("all"), q: str | None = None, tag: str | None = None,
                session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.list_notes(session, user.tenant_id, folder, q, tag)


@router.post("/notes", status_code=201)
async def create_note(body: NoteCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    nb = await svc.create_note(session, user.tenant_id, body)
    return {"id": str(nb.id)}


@router.get("/notes/{nid}")
async def note(nid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.detail(session, user.tenant_id, uuid.UUID(nid))


@router.patch("/notes/{nid}")
async def patch_note(nid: str, body: NotePatchIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.patch_note(session, user.tenant_id, uuid.UUID(nid), body)


@router.put("/notes/{nid}/tags")
async def set_tags(nid: str, body: TagSetIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return {"tags": await svc.set_tags(session, user.tenant_id, uuid.UUID(nid), body.tags)}


@router.delete("/notes/{nid}", status_code=204)
async def soft_delete(nid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.soft_delete(session, user.tenant_id, uuid.UUID(nid)); return Response(status_code=204)


@router.post("/notes/{nid}/restore")
async def restore(nid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.restore(session, user.tenant_id, uuid.UUID(nid)); return {"ok": True}


@router.delete("/notes/{nid}/permanent", status_code=204)
async def purge(nid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.purge(session, user.tenant_id, uuid.UUID(nid)); return Response(status_code=204)


@router.post("/notes/{nid}/share")
async def share(nid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    tok = await svc.toggle_share(session, user.tenant_id, uuid.UUID(nid))
    return {"shareToken": tok, "url": f"/notebook/public/{tok}" if tok else None}


@router.get("/notes/{nid}/export", response_class=HTMLResponse)
async def export_note(nid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    d = await svc.detail(session, user.tenant_id, uuid.UUID(nid))
    return svc.export_html(d["title"], d["bodyHtml"], d["stats"], f"Created {d['createdAt']} · Updated {d['updatedAt']}")


@router.get("/public/{token}", response_class=HTMLResponse)
async def public_note(token: str, session: AsyncSession = Depends(get_session)):
    d = await svc.public_note(session, token)
    return svc.export_html(d["title"], d["bodyHtml"], [], f"Shared note · updated {d['updatedAt']}")


@router.post("/folders", status_code=201)
async def folder_create(body: FolderCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return {"id": await svc.folders_create(session, user.tenant_id, body)}


@router.patch("/folders/{fid}")
async def folder_patch(fid: str, body: FolderPatchIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.folders_patch(session, user.tenant_id, uuid.UUID(fid), body); return {"ok": True}


@router.delete("/folders/{fid}", status_code=204)
async def folder_delete(fid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.folders_delete(session, user.tenant_id, uuid.UUID(fid)); return Response(status_code=204)


@router.get("/templates")
async def templates(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.templates_list(session, user.tenant_id)


@router.post("/templates", status_code=201)
async def template_create(body: TemplateCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return {"id": await svc.templates_create(session, user.tenant_id, body)}


@router.patch("/templates/{tid}")
async def template_patch(tid: str, body: TemplatePatchIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.templates_patch(session, user.tenant_id, uuid.UUID(tid), body); return {"ok": True}


@router.delete("/templates/{tid}", status_code=204)
async def template_delete(tid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.templates_delete(session, user.tenant_id, uuid.UUID(tid)); return Response(status_code=204)