import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column




class Base(DeclarativeBase):
    pass


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    chart_style: Mapped[str] = mapped_column(String(20), default="lightweight")
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar: Mapped[str] = mapped_column(String(16), default="")
    theme_pref: Mapped[str] = mapped_column(String(16), default="system")
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    broker: Mapped[str] = mapped_column(String(40), default="webull")
    timezone: Mapped[str] = mapped_column(String(60), default="US/Eastern")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BrokerConnection(Base):
    __tablename__ = "broker_connections"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    broker: Mapped[str] = mapped_column(String(40))
    label: Mapped[str] = mapped_column(String(120), default="")
    credentials_encrypted: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JournalDay(Base):
    __tablename__ = "journal_days"
    __table_args__ = (UniqueConstraint("tenant_id", "day", name="uq_journal_days_tenant_day"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    day: Mapped[date] = mapped_column(Date())
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Playbook(Base):
    __tablename__ = "playbooks"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(16), default="")
    color: Mapped[str] = mapped_column(String(9), default="#6D5DE7")
    visibility: Mapped[str] = mapped_column(String(10), default="private")  # private | shared
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PlaybookRuleGroup(Base):
    __tablename__ = "playbook_rule_groups"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)


class PlaybookRule(Base):
    __tablename__ = "playbook_rules"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbook_rule_groups.id", ondelete="CASCADE"), index=True)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    visibility: Mapped[str] = mapped_column(String(12), default="always")  # always|winner|loser|break_even
    position: Mapped[int] = mapped_column(Integer, default=0)


class TradeRuleMark(Base):
    __tablename__ = "trade_rule_marks"
    __table_args__ = (UniqueConstraint("trade_id", "rule_id", name="uq_marks_trade_rule"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trade_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trades.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbook_rules.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    followed: Mapped[bool] = mapped_column(Boolean, default=False)


class MissedTrade(Base):
    __tablename__ = "missed_trades"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(16))
    side: Mapped[str] = mapped_column(String(8), default="buy")
    qty: Mapped[float] = mapped_column(Numeric(12, 4), default=1)
    open_date: Mapped[date] = mapped_column(Date())
    close_date: Mapped[date] = mapped_column(Date())
    entry_price: Mapped[float] = mapped_column(Numeric(14, 4))
    exit_price: Mapped[float] = mapped_column(Numeric(14, 4))
    net_pnl: Mapped[float] = mapped_column(Numeric(12, 2))
    net_roi: Mapped[float] = mapped_column(Numeric(10, 4), default=0)
    status: Mapped[str] = mapped_column(String(10), default="win")  # win|loss|break_even
    setups: Mapped[str | None] = mapped_column(Text, nullable=True)


class PlaybookNote(Base):
    __tablename__ = "playbook_notes"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Untitled")
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PlaybookShare(Base):
    __tablename__ = "playbook_shares"
    __table_args__ = (UniqueConstraint("playbook_id", "user_id", name="uq_share_playbook_user"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))


class Trade(Base):
    __tablename__ = "trades"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"), nullable=True, index=True)
    playbook_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("playbooks.id"), nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    instrument: Mapped[str | None] = mapped_column(String(64), nullable=True)
    asset_type: Mapped[str] = mapped_column(String(20), default="stock")
    qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    status: Mapped[str] = mapped_column(String(8), default="closed", index=True)
    open_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    close_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    net_pnl: Mapped[float] = mapped_column(Numeric(12, 2))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    playbook: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    setups: Mapped[str | None] = mapped_column(Text, nullable=True)
    mistakes: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    profit_target: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    stop_loss: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    initial_target: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    planned_r: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Execution(Base):
    __tablename__ = "executions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trade_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trades.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(16))
    side: Mapped[str] = mapped_column(String(8))
    qty: Mapped[float] = mapped_column(Numeric(12, 4))
    price: Mapped[float] = mapped_column(Numeric(14, 4))
    commission: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    fee: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class BacktestSession(Base):
    __tablename__ = "backtest_sessions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    playbook_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("playbooks.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    asset_type: Mapped[str] = mapped_column(String(16), default="stocks")
    symbol: Mapped[str] = mapped_column(String(24))
    start_balance: Mapped[float] = mapped_column(Numeric(14, 2), default=100000)
    start_date: Mapped[date] = mapped_column(Date())
    end_date: Mapped[date] = mapped_column(Date())
    interval: Mapped[str] = mapped_column(String(4), default="1m")
    last_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    visibility: Mapped[str] = mapped_column(String(10), default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BacktestAction(Base):
    __tablename__ = "backtest_actions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)  # client-supplied, stable across cancel/modify
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("backtest_sessions.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    at_time: Mapped[int] = mapped_column(BigInteger())
    kind: Mapped[str] = mapped_column(String(10))  # order | cancel | close | modify
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BacktestShare(Base):
    __tablename__ = "backtest_shares"
    __table_args__ = (UniqueConstraint("session_id", "user_id", name="uq_btshare_session_user"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("backtest_sessions.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class NoteFolder(Base):
    __tablename__ = "note_folders"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    color: Mapped[str] = mapped_column(String(9), default="")
    kind: Mapped[str] = mapped_column(String(10), default="custom")
    link_type: Mapped[str | None] = mapped_column(String(12), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notebook(Base):
    __tablename__ = "notebooks"
    __table_args__ = (UniqueConstraint("tenant_id", "link_type", "link_id", name="uq_nb_link"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("note_folders.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), default="Untitled")
    body_html: Mapped[str] = mapped_column(Text, default="")
    link_type: Mapped[str] = mapped_column(String(12), default="manual")
    link_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    source: Mapped[str] = mapped_column(String(8), default="manual")
    starred: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[str | None] = mapped_column(String(40), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NoteTag(Base):
    __tablename__ = "note_tags"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_nt_tag"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(60))


class NotebookTag(Base):
    __tablename__ = "notebook_tags"
    notebook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("notebooks.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("note_tags.id", ondelete="CASCADE"), primary_key=True)


class NoteTemplate(Base):
    __tablename__ = "note_templates"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    body_html: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(12), default="custom")
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    favourite: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())