from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class SavingsPlan:
    monthly_amount_needed: Decimal | None
    months_remaining: int | None
    is_feasible: bool | None
    savings_shortfall: Decimal | None


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _months_between(today: date, target_date: date) -> int:
    """Whole months from today to target_date, rounded up, minimum 1."""
    months = (target_date.year - today.year) * 12 + (target_date.month - today.month)
    if target_date.day > today.day:
        months += 1
    return max(months, 1)


def compute_savings_plan(
    *,
    target_amount: Decimal,
    current_amount: Decimal,
    target_date: date | None,
    is_completed: bool,
    disposable_income: Decimal,
    today: date | None = None,
) -> SavingsPlan:
    """How much the user must save per month to reach a goal by its target date."""
    if is_completed or target_date is None:
        return SavingsPlan(
            monthly_amount_needed=None,
            months_remaining=None,
            is_feasible=None,
            savings_shortfall=None,
        )

    today = today or date.today()
    remaining_amount = target_amount - current_amount
    if remaining_amount < 0:
        remaining_amount = Decimal("0")

    months_remaining = _months_between(today, target_date)
    monthly_amount_needed = _quantize(remaining_amount / Decimal(months_remaining))

    is_feasible = disposable_income >= monthly_amount_needed
    shortfall = monthly_amount_needed - disposable_income
    savings_shortfall = _quantize(shortfall) if shortfall > 0 else Decimal("0")

    return SavingsPlan(
        monthly_amount_needed=monthly_amount_needed,
        months_remaining=months_remaining,
        is_feasible=is_feasible,
        savings_shortfall=savings_shortfall,
    )
