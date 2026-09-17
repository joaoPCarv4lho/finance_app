from datetime import date
from decimal import Decimal

from app.services.goal_planning import compute_savings_plan


def test_no_target_date_returns_empty_plan():
    plan = compute_savings_plan(
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("200.00"),
        target_date=None,
        is_completed=False,
        disposable_income=Decimal("500.00"),
    )
    assert plan.monthly_amount_needed is None
    assert plan.months_remaining is None
    assert plan.is_feasible is None
    assert plan.savings_shortfall is None


def test_completed_goal_returns_empty_plan_even_with_target_date():
    plan = compute_savings_plan(
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("1000.00"),
        target_date=date(2027, 1, 1),
        is_completed=True,
        disposable_income=Decimal("500.00"),
    )
    assert plan.monthly_amount_needed is None


def test_feasible_goal_a_few_months_out():
    plan = compute_savings_plan(
        target_amount=Decimal("3000.00"),
        current_amount=Decimal("0.00"),
        target_date=date(2027, 3, 17),
        is_completed=False,
        disposable_income=Decimal("600.00"),
        today=date(2026, 9, 17),
    )
    assert plan.months_remaining == 6
    assert plan.monthly_amount_needed == Decimal("500.00")
    assert plan.is_feasible is True
    assert plan.savings_shortfall == Decimal("0")


def test_infeasible_goal_reports_shortfall():
    plan = compute_savings_plan(
        target_amount=Decimal("3000.00"),
        current_amount=Decimal("0.00"),
        target_date=date(2027, 3, 17),
        is_completed=False,
        disposable_income=Decimal("300.00"),
        today=date(2026, 9, 17),
    )
    assert plan.monthly_amount_needed == Decimal("500.00")
    assert plan.is_feasible is False
    assert plan.savings_shortfall == Decimal("200.00")


def test_target_date_already_past_treats_as_due_now():
    plan = compute_savings_plan(
        target_amount=Decimal("500.00"),
        current_amount=Decimal("100.00"),
        target_date=date(2026, 1, 1),
        is_completed=False,
        disposable_income=Decimal("1000.00"),
        today=date(2026, 9, 17),
    )
    assert plan.months_remaining == 1
    assert plan.monthly_amount_needed == Decimal("400.00")
    assert plan.is_feasible is True


def test_current_amount_already_exceeds_target_but_not_flagged_completed():
    plan = compute_savings_plan(
        target_amount=Decimal("500.00"),
        current_amount=Decimal("600.00"),
        target_date=date(2027, 1, 1),
        is_completed=False,
        disposable_income=Decimal("0.00"),
        today=date(2026, 9, 17),
    )
    assert plan.monthly_amount_needed == Decimal("0.00")
    assert plan.is_feasible is True
    assert plan.savings_shortfall == Decimal("0")
