from fastapi import APIRouter

from app.api import accounts, analytics, auth, backtests, brokers, dashboard, journal, market, notebook, playbooks, reports, settings, trades, users

api_router = APIRouter(prefix="/api")


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "tradeJournaling"}


api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(accounts.router, tags=["accounts"])
api_router.include_router(dashboard.router, tags=["dashboard"])
api_router.include_router(journal.router, tags=["journal"])
api_router.include_router(trades.router, tags=["trades"])
api_router.include_router(brokers.router, tags=["brokers"])
api_router.include_router(market.router, tags=["market"])
api_router.include_router(playbooks.router, tags=["playbooks"])
api_router.include_router(backtests.router, tags=["backtests"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(notebook.router, tags=["notebook"])
api_router.include_router(reports.router, tags=["reports"])
api_router.include_router(analytics.router, tags=["analytics"])