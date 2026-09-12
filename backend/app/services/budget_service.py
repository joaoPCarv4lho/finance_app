import calendar
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionType
from app.models.user import BudgetMode, User
from app.schemas.dashboard import SpendingCeiling

# In the 50/30/20 rule, 50% needs + 30% wants = 80% is spendable, 20% saved.
SPENDABLE_RATIO = Decimal("0.80")
SAVINGS_RATIO = Decimal("0.20")


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


class BudgetService:
    @staticmethod
    async def _expenses_in_month(
        db: AsyncSession, user_id: uuid.UUID, month: int, year: int
    ) -> Decimal:
        query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.EXPENSE,
            func.extract("month", Transaction.transaction_date) == month,
            func.extract("year", Transaction.transaction_date) == year,
        )
        result = await db.execute(query)
        return Decimal(str(result.scalar() or 0))

    @staticmethod
    async def get_spending_ceiling(
        db: AsyncSession, user: User, month: int, year: int
    ) -> SpendingCeiling:
        income = Decimal(user.monthly_income or 0)

        if user.budget_mode == BudgetMode.FREE:
            monthly_budget = Decimal(user.monthly_budget or 0)
            savings_target = income - monthly_budget
            if savings_target < 0:
                savings_target = Decimal("0")
        else:  # RULE_50_30_20
            monthly_budget = income * SPENDABLE_RATIO
            savings_target = income * SAVINGS_RATIO

        spent = await BudgetService._expenses_in_month(db, user.id, month, year)

        safe_month = monthly_budget - spent
        over_budget = safe_month < 0
        if safe_month < 0:
            safe_month = Decimal("0")

        # Days remaining in the month, counting today when we're in the current
        # month; otherwise the full month length.
        today = date.today()
        days_in_month = calendar.monthrange(year, month)[1]
        if today.year == year and today.month == month:
            days_left = days_in_month - today.day + 1
        else:
            days_left = days_in_month
        days_left = max(days_left, 1)

        safe_today = safe_month / Decimal(days_left)

        return SpendingCeiling(
            budget_mode=user.budget_mode,
            monthly_income=_quantize(income),
            monthly_budget=_quantize(monthly_budget),
            spent_this_month=_quantize(spent),
            safe_to_spend_month=_quantize(safe_month),
            safe_to_spend_today=_quantize(safe_today),
            days_left_in_month=days_left,
            savings_target=_quantize(savings_target),
            over_budget=over_budget,
        )
