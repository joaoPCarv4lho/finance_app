import uuid
from decimal import Decimal

from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.dashboard import (
    DashboardOut,
    GoalsProgress,
    MonthlySummary,
)
from app.services.budget_service import BudgetService


def _q(value: Decimal) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


class DashboardService:
    @staticmethod
    async def get_monthly_summary(
        db: AsyncSession, user_id: uuid.UUID, month: int, year: int
    ) -> MonthlySummary:
        query = (
            select(Transaction.type, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.user_id == user_id,
                func.extract("month", Transaction.transaction_date) == month,
                func.extract("year", Transaction.transaction_date) == year,
            )
            .group_by(Transaction.type)
        )
        result = await db.execute(query)

        totals = {
            TransactionType.INCOME: Decimal("0"),
            TransactionType.EXPENSE: Decimal("0"),
            TransactionType.INVESTMENT: Decimal("0"),
        }
        for ttype, total in result.all():
            totals[ttype] = Decimal(str(total))

        income = totals[TransactionType.INCOME]
        expense = totals[TransactionType.EXPENSE]
        invested = totals[TransactionType.INVESTMENT]

        return MonthlySummary(
            month=month,
            year=year,
            total_income=_q(income),
            total_expense=_q(expense),
            total_invested=_q(invested),
            net_savings=_q(income - expense),
        )

    @staticmethod
    async def get_goals_progress(
        db: AsyncSession, user_id: uuid.UUID
    ) -> GoalsProgress:
        query = select(
            func.count(Goal.id),
            func.coalesce(func.sum(func.cast(Goal.is_completed, Integer)), 0),
            func.coalesce(func.sum(Goal.target_amount), 0),
            func.coalesce(func.sum(Goal.current_amount), 0),
        ).where(Goal.user_id == user_id)
        result = await db.execute(query)
        total_goals, completed, total_target, total_saved = result.one()

        total_target = Decimal(str(total_target))
        total_saved = Decimal(str(total_saved))
        overall = (
            float(min(total_saved / total_target, Decimal("1"))) * 100
            if total_target > 0
            else 0.0
        )

        return GoalsProgress(
            total_goals=int(total_goals),
            completed_goals=int(completed),
            total_target=_q(total_target),
            total_saved=_q(total_saved),
            overall_progress_percent=round(overall, 2),
        )

    @staticmethod
    async def get_dashboard(
        db: AsyncSession, user: User, month: int, year: int
    ) -> DashboardOut:
        summary = await DashboardService.get_monthly_summary(db, user.id, month, year)
        ceiling = await BudgetService.get_spending_ceiling(db, user, month, year)
        goals = await DashboardService.get_goals_progress(db, user.id)
        return DashboardOut(summary=summary, ceiling=ceiling, goals=goals)
