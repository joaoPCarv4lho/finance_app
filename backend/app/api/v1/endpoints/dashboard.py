from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardOut, MonthlySummary, SpendingCeiling
from app.services.budget_service import BudgetService
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MonthParam = Query(default=None, ge=1, le=12, description="Mês (1-12); padrão: atual")
YearParam = Query(default=None, ge=2000, le=2100, description="Ano; padrão: atual")


def _resolve_period(month: int | None, year: int | None) -> tuple[int, int]:
    today = date.today()
    return (month or today.month, year or today.year)


@router.get("", response_model=DashboardOut)
async def get_dashboard(
    current_user: CurrentUser,
    db: DbSession,
    month: int | None = MonthParam,
    year: int | None = YearParam,
) -> DashboardOut:
    """Full dashboard: monthly summary (RF05), spending ceiling (RF03) and
    goals progress (RF04) in a single call."""
    m, y = _resolve_period(month, year)
    return await DashboardService.get_dashboard(db, current_user, m, y)


@router.get("/summary", response_model=MonthlySummary)
async def get_summary(
    current_user: CurrentUser,
    db: DbSession,
    month: int | None = MonthParam,
    year: int | None = YearParam,
) -> MonthlySummary:
    """RF05 — The three headline numbers: income, expense, invested."""
    m, y = _resolve_period(month, year)
    return await DashboardService.get_monthly_summary(db, current_user.id, m, y)


@router.get("/spending-ceiling", response_model=SpendingCeiling)
async def get_spending_ceiling(
    current_user: CurrentUser,
    db: DbSession,
    month: int | None = MonthParam,
    year: int | None = YearParam,
) -> SpendingCeiling:
    """RF03 — How much the user can still spend this month / today."""
    m, y = _resolve_period(month, year)
    return await BudgetService.get_spending_ceiling(db, current_user, m, y)
