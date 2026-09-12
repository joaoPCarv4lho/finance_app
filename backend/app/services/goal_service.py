import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalUpdate


class GoalService:
    @staticmethod
    async def create(db: AsyncSession, user_id: uuid.UUID, data: GoalCreate) -> Goal:
        goal = Goal(
            user_id=user_id,
            name=data.name,
            target_amount=data.target_amount,
            current_amount=data.current_amount,
            target_date=data.target_date,
        )
        goal.is_completed = goal.current_amount >= goal.target_amount
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def get(
        db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID
    ) -> Goal | None:
        query = select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list(db: AsyncSession, user_id: uuid.UUID) -> list[Goal]:
        query = (
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.is_completed, Goal.created_at)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update(db: AsyncSession, goal: Goal, data: GoalUpdate) -> Goal:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(goal, field, value)
        # Keep completion flag consistent unless explicitly set by the caller.
        if "is_completed" not in data.model_dump(exclude_unset=True):
            goal.is_completed = Decimal(goal.current_amount) >= Decimal(goal.target_amount)
        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def contribute(db: AsyncSession, goal: Goal, amount: Decimal) -> Goal:
        new_amount = Decimal(goal.current_amount) + amount
        goal.current_amount = new_amount if new_amount > 0 else Decimal("0")
        goal.is_completed = Decimal(goal.current_amount) >= Decimal(goal.target_amount)
        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def delete(db: AsyncSession, goal: Goal) -> None:
        await db.delete(goal)
        await db.commit()
