from decimal import Decimal

from pydantic import BaseModel

from app.models.user import BudgetMode


class MonthlySummary(BaseModel):
    """The three headline numbers of the simplified summary (RF05)."""

    month: int
    year: int
    total_income: Decimal
    total_expense: Decimal
    total_invested: Decimal
    net_savings: Decimal  # income - expense


class SpendingCeiling(BaseModel):
    """How much the user can still spend this month / today (RF03)."""

    budget_mode: BudgetMode
    monthly_income: Decimal
    monthly_budget: Decimal  # the spendable ceiling for the month
    spent_this_month: Decimal
    safe_to_spend_month: Decimal  # budget - spent (min 0)
    safe_to_spend_today: Decimal  # remaining spread over remaining days
    days_left_in_month: int
    savings_target: Decimal  # amount reserved for saving/investing this month
    over_budget: bool


class GoalsProgress(BaseModel):
    total_goals: int
    completed_goals: int
    total_target: Decimal
    total_saved: Decimal
    overall_progress_percent: float


class DashboardOut(BaseModel):
    summary: MonthlySummary
    ceiling: SpendingCeiling
    goals: GoalsProgress
