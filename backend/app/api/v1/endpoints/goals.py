import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.goal import (
    GoalContribution,
    GoalCreate,
    GoalOut,
    GoalUpdate,
)
from app.services.goal_service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate, current_user: CurrentUser, db: DbSession
) -> GoalOut:
    """RF04 — Create a savings/investment goal (e.g. Emergency Fund)."""
    goal = await GoalService.create(db, current_user.id, data)
    return GoalOut.model_validate(goal)


@router.get("", response_model=list[GoalOut])
async def list_goals(current_user: CurrentUser, db: DbSession) -> list[GoalOut]:
    goals = await GoalService.list(db, current_user.id)
    return [GoalOut.model_validate(g) for g in goals]


async def _get_or_404(db, user_id, goal_id):
    goal = await GoalService.get(db, user_id, goal_id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meta não encontrada"
        )
    return goal


@router.get("/{goal_id}", response_model=GoalOut)
async def get_goal(
    goal_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> GoalOut:
    goal = await _get_or_404(db, current_user.id, goal_id)
    return GoalOut.model_validate(goal)


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: uuid.UUID,
    data: GoalUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalOut:
    goal = await _get_or_404(db, current_user.id, goal_id)
    updated = await GoalService.update(db, goal, data)
    return GoalOut.model_validate(updated)


@router.post("/{goal_id}/contribute", response_model=GoalOut)
async def contribute_to_goal(
    goal_id: uuid.UUID,
    data: GoalContribution,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalOut:
    """Add an amount to a goal's accumulated value (updates the progress bar)."""
    goal = await _get_or_404(db, current_user.id, goal_id)
    updated = await GoalService.contribute(db, goal, data.amount)
    return GoalOut.model_validate(updated)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    goal = await _get_or_404(db, current_user.id, goal_id)
    await GoalService.delete(db, goal)
