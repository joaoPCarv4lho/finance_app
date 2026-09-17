import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.goal import Goal
from app.services.goal_planning import compute_savings_plan


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: Decimal = Field(gt=0)
    current_amount: Decimal = Field(default=Decimal("0"), ge=0)
    target_date: date | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target_amount: Decimal | None = Field(default=None, gt=0)
    current_amount: Decimal | None = Field(default=None, ge=0)
    target_date: date | None = None
    is_completed: bool | None = None


class GoalContribution(BaseModel):
    """Add (or subtract, if negative) an amount to a goal's accumulated value."""

    amount: Decimal = Field(description="Amount to add to current_amount")


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    is_completed: bool
    created_at: datetime

    disposable_income: Decimal = Decimal("0")
    monthly_amount_needed: Decimal | None = None
    months_remaining: int | None = None
    is_feasible: bool | None = None
    savings_shortfall: Decimal | None = None

    @computed_field
    @property
    def progress_percent(self) -> float:
        """Progress toward the target, clamped to 0–100 (for the progress bar)."""
        if self.target_amount <= 0:
            return 0.0
        pct = float(self.current_amount) / float(self.target_amount) * 100
        return round(min(max(pct, 0.0), 100.0), 2)

    @computed_field
    @property
    def remaining_amount(self) -> Decimal:
        remaining = self.target_amount - self.current_amount
        return remaining if remaining > 0 else Decimal("0")

    @classmethod
    def from_goal(cls, goal: Goal, disposable_income: Decimal) -> "GoalOut":
        """Build a GoalOut with the savings plan computed from disposable_income."""
        plan = compute_savings_plan(
            target_amount=Decimal(goal.target_amount),
            current_amount=Decimal(goal.current_amount),
            target_date=goal.target_date,
            is_completed=goal.is_completed,
            disposable_income=disposable_income,
        )
        out = cls.model_validate(goal)
        return out.model_copy(
            update={
                "disposable_income": disposable_income,
                "monthly_amount_needed": plan.monthly_amount_needed,
                "months_remaining": plan.months_remaining,
                "is_feasible": plan.is_feasible,
                "savings_shortfall": plan.savings_shortfall,
            }
        )
