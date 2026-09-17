import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixed_expense import FixedExpense
from app.models.user import User


async def test_create_and_read_fixed_expense(db_session: AsyncSession):
    user = User(
        username="ana",
        email="ana@example.com",
        password_hash="hashed",
        monthly_income=Decimal("5000.00"),
    )
    db_session.add(user)
    await db_session.flush()

    expense = FixedExpense(user_id=user.id, name="Aluguel", amount=Decimal("1200.00"))
    db_session.add(expense)
    await db_session.commit()

    result = await db_session.execute(
        select(FixedExpense).where(FixedExpense.user_id == user.id)
    )
    saved = result.scalar_one()
    assert saved.name == "Aluguel"
    assert saved.amount == Decimal("1200.00")
    assert isinstance(saved.id, uuid.UUID)


async def test_deleting_user_cascades_to_fixed_expenses(db_session: AsyncSession):
    user = User(
        username="bia",
        email="bia@example.com",
        password_hash="hashed",
        monthly_income=Decimal("4000.00"),
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        FixedExpense(user_id=user.id, name="Internet", amount=Decimal("100.00"))
    )
    await db_session.commit()

    await db_session.delete(user)
    await db_session.commit()

    result = await db_session.execute(select(FixedExpense))
    assert result.scalar_one_or_none() is None
