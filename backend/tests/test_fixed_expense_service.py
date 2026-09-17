from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.fixed_expense import FixedExpenseCreate, FixedExpenseUpdate
from app.services.fixed_expense_service import FixedExpenseService


async def _make_user(db_session: AsyncSession) -> User:
    user = User(
        username="carla",
        email="carla@example.com",
        password_hash="hashed",
        monthly_income=Decimal("4500.00"),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_create_and_list(db_session: AsyncSession):
    user = await _make_user(db_session)
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Aluguel", amount=Decimal("1200.00"))
    )
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Internet", amount=Decimal("100.00"))
    )

    items = await FixedExpenseService.list(db_session, user.id)
    assert [item.name for item in items] == ["Aluguel", "Internet"]


async def test_update_changes_only_given_fields(db_session: AsyncSession):
    user = await _make_user(db_session)
    expense = await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Streaming", amount=Decimal("40.00"))
    )

    updated = await FixedExpenseService.update(
        db_session, expense, FixedExpenseUpdate(amount=Decimal("55.00"))
    )

    assert updated.name == "Streaming"
    assert updated.amount == Decimal("55.00")


async def test_update_with_explicit_none_name_keeps_original_and_updates_amount(
    db_session: AsyncSession,
):
    user = await _make_user(db_session)
    expense = await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Streaming", amount=Decimal("40.00"))
    )

    # Simula um payload que tecnicamente enviou "name": null, mas cujo objetivo
    # era atualizar apenas o amount. exclude_none=True deve impedir que o
    # setattr grave None na coluna NOT NULL `name`.
    updated = await FixedExpenseService.update(
        db_session,
        expense,
        FixedExpenseUpdate(name=None, amount=Decimal("50.00")),
    )

    assert updated.name == "Streaming"
    assert updated.amount == Decimal("50.00")


async def test_delete_removes_expense(db_session: AsyncSession):
    user = await _make_user(db_session)
    expense = await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Água", amount=Decimal("60.00"))
    )

    await FixedExpenseService.delete(db_session, expense)

    assert await FixedExpenseService.get(db_session, user.id, expense.id) is None


async def test_total_for_user_sums_all_amounts(db_session: AsyncSession):
    user = await _make_user(db_session)
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Aluguel", amount=Decimal("1200.00"))
    )
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Internet", amount=Decimal("100.50"))
    )

    total = await FixedExpenseService.total_for_user(db_session, user.id)

    assert total == Decimal("1300.50")


async def test_total_for_user_with_no_expenses_is_zero(db_session: AsyncSession):
    user = await _make_user(db_session)

    total = await FixedExpenseService.total_for_user(db_session, user.id)

    assert total == Decimal("0")
