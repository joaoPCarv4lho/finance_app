import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.transaction import TransactionType

# Default categories created for every new user so registration is friction-free.
DEFAULT_CATEGORIES: list[tuple[str, TransactionType, str]] = [
    ("Salário", TransactionType.INCOME, "💼"),
    ("Renda Extra", TransactionType.INCOME, "💰"),
    ("Alimentação", TransactionType.EXPENSE, "🍔"),
    ("Moradia", TransactionType.EXPENSE, "🏠"),
    ("Transporte", TransactionType.EXPENSE, "🚗"),
    ("Lazer", TransactionType.EXPENSE, "🎮"),
    ("Saúde", TransactionType.EXPENSE, "🩺"),
    ("Contas", TransactionType.EXPENSE, "🧾"),
    ("Reserva de Emergência", TransactionType.INVESTMENT, "🛟"),
    ("Renda Fixa", TransactionType.INVESTMENT, "🏦"),
    ("Ações / FIIs", TransactionType.INVESTMENT, "📈"),
]


class CategoryService:
    @staticmethod
    async def seed_defaults(db: AsyncSession, user_id: uuid.UUID) -> None:
        """Create the default category set for a freshly registered user."""
        db.add_all(
            Category(user_id=user_id, name=name, type=ttype, icon=icon)
            for name, ttype, icon in DEFAULT_CATEGORIES
        )
        await db.flush()

    @staticmethod
    async def list(
        db: AsyncSession, user_id: uuid.UUID, type_: TransactionType | None = None
    ) -> list[Category]:
        query = select(Category).where(Category.user_id == user_id)
        if type_ is not None:
            query = query.where(Category.type == type_)
        query = query.order_by(Category.type, Category.name)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get(
        db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID
    ) -> Category | None:
        query = select(Category).where(
            Category.id == category_id, Category.user_id == user_id
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(
        db: AsyncSession,
        user_id: uuid.UUID,
        name: str,
        type_: TransactionType,
        icon: str | None = None,
    ) -> Category:
        category = Category(user_id=user_id, name=name, type=type_, icon=icon)
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category
