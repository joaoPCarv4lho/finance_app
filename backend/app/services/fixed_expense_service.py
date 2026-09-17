import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixed_expense import FixedExpense
from app.schemas.fixed_expense import FixedExpenseCreate, FixedExpenseUpdate


class FixedExpenseService:
    @staticmethod
    async def create(
        db: AsyncSession, user_id: uuid.UUID, data: FixedExpenseCreate
    ) -> FixedExpense:
        expense = FixedExpense(user_id=user_id, name=data.name, amount=data.amount)
        db.add(expense)
        await db.commit()
        await db.refresh(expense)
        return expense

    @staticmethod
    async def get(
        db: AsyncSession, user_id: uuid.UUID, expense_id: uuid.UUID
    ) -> FixedExpense | None:
        query = select(FixedExpense).where(
            FixedExpense.id == expense_id, FixedExpense.user_id == user_id
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list(db: AsyncSession, user_id: uuid.UUID) -> list[FixedExpense]:
        query = (
            select(FixedExpense)
            .where(FixedExpense.user_id == user_id)
            .order_by(FixedExpense.created_at)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update(
        db: AsyncSession, expense: FixedExpense, data: FixedExpenseUpdate
    ) -> FixedExpense:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(expense, field, value)
        await db.commit()
        await db.refresh(expense)
        return expense

    @staticmethod
    async def delete(db: AsyncSession, expense: FixedExpense) -> None:
        await db.delete(expense)
        await db.commit()

    @staticmethod
    async def total_for_user(db: AsyncSession, user_id: uuid.UUID) -> Decimal:
        query = select(func.coalesce(func.sum(FixedExpense.amount), 0)).where(
            FixedExpense.user_id == user_id
        )
        result = await db.execute(query)
        return Decimal(str(result.scalar() or 0))
