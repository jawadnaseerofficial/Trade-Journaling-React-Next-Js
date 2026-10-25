from pydantic import BaseModel, Field

from app.schemas.dashboard import CamelModel


class FolderCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default="", max_length=9)


class FolderPatchIn(BaseModel):
    name: str | None = None
    color: str | None = None
    position: int | None = None


class NoteCreateIn(BaseModel):
    folder_id: str | None = None
    title: str | None = None
    body_html: str | None = None


class NotePatchIn(BaseModel):
    title: str | None = None
    body_html: str | None = None
    starred: bool | None = None
    folder_id: str | None = None


class TagSetIn(BaseModel):
    tags: list[str] = Field(default_factory=list)


class TemplateCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    body_html: str = Field(default="")
    category: str = Field(default="custom", pattern=r"^(recommended|custom)$")


class TemplatePatchIn(BaseModel):
    name: str | None = None
    body_html: str | None = None
    favourite: bool | None = None


class FolderOut(CamelModel):
    id: str
    name: str
    color: str
    kind: str
    link_type: str | None
    count: int


class TagOut(CamelModel):
    id: str
    name: str
    count: int


class NoteListItem(CamelModel):
    id: str
    title: str
    folder_id: str | None
    link_type: str
    link_id: str | None
    source: str
    starred: bool
    shares: int
    net_pnl: float | None
    subtitle: str | None
    updated_at: str


class StatKV(CamelModel):
    label: str
    value: str
    tone: str | None = None


class NoteDetailOut(CamelModel):
    id: str
    title: str
    body_html: str
    link_type: str
    link_id: str | None
    source: str
    starred: bool
    share_token: str | None
    created_at: str
    updated_at: str
    tags: list[str]
    stats: list[StatKV]
    headline_pnl: float | None
    chart: list[dict]            # [{date,value}] cumulative (daily/recap) or [] for trade
    trade_ids: list[str]         # linked trades -> "View trade details"
    readonly: bool               # backtest-derived notes are read-only here


class TemplateOut(CamelModel):
    id: str
    name: str
    body_html: str
    category: str
    is_builtin: bool
    favourite: bool


class TreeOut(CamelModel):
    folders: list[FolderOut]
    tags: list[TagOut]
    deleted_count: int
    all_count: int