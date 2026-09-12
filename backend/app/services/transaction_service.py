import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.transaction import Transaction, TransactionType
from app.schemas.transaction import TransactionCreate, TransactionUpdate


class TransactionService:
    @staticmethod
    async def create(
        db: AsyncSession, user_id: uuid.UUID, data: TransactionCreate
    ) -> Transaction:
        transaction = Transaction(
            user_id=user_id,
            amount=data.amount,
            type=data.type,
            category_id=data.category_id,
            description=data.description,
            transaction_date=data.transaction_date or date.today(),
        )
        db.add(transaction)
        await db.commit()
        # Re-fetch with the category eager-loaded for the response.
        return await TransactionService.get(db, user_id, transaction.id)

    @staticmethod
    async def get(
        db: AsyncSession, user_id: uuid.UUID, transaction_id: uuid.UUID
    ) -> Transaction | None:
        query = (
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(Transaction.id == transaction_id, Transaction.user_id == user_id)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list(
        db: AsyncSession,
        user_id: uuid.UUID,
        *,
        type_: TransactionType | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Transaction]:
        query = (
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(Transaction.user_id == user_id)
        )
        if type_ is not None:
            query = query.where(Transaction.type == type_)
        if start_date is not None:
            query = query.where(Transaction.transaction_date >= start_date)
        if end_date is not None:
            query = query.where(Transaction.transaction_date <= end_date)
        query = (
            query.order_by(
                Transaction.transaction_date.desc(), Transaction.created_at.desc()
            )
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update(
        db: AsyncSession,
        transaction: Transaction,
        data: TransactionUpdate,
    ) -> Transaction:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(transaction, field, value)
        await db.commit()
        await db.refresh(transaction, attribute_names=["category"])
        return transaction

    @staticmethod
    async def delete(db: AsyncSession, transaction: Transaction) -> None:
        await db.delete(transaction)
        await db.commit()
