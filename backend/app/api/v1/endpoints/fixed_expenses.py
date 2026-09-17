import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.fixed_expense import (
    FixedExpenseCreate,
    FixedExpenseOut,
    FixedExpenseUpdate,
)
from app.services.fixed_expense_service import FixedExpenseService

router = APIRouter(prefix="/fixed-expenses", tags=["fixed-expenses"])


@router.post("", response_model=FixedExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_fixed_expense(
    data: FixedExpenseCreate, current_user: CurrentUser, db: DbSession
) -> FixedExpenseOut:
    expense = await FixedExpenseService.create(db, current_user.id, data)
    return FixedExpenseOut.model_validate(expense)


@router.get("", response_model=list[FixedExpenseOut])
async def list_fixed_expenses(
    current_user: CurrentUser, db: DbSession
) -> list[FixedExpenseOut]:
    expenses = await FixedExpenseService.list(db, current_user.id)
    return [FixedExpenseOut.model_validate(e) for e in expenses]


async def _get_or_404(db, user_id, expense_id):
    expense = await FixedExpenseService.get(db, user_id, expense_id)
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gasto fixo não encontrado"
        )
    return expense


@router.patch("/{expense_id}", response_model=FixedExpenseOut)
async def update_fixed_expense(
    expense_id: uuid.UUID,
    data: FixedExpenseUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> FixedExpenseOut:
    expense = await _get_or_404(db, current_user.id, expense_id)
    updated = await FixedExpenseService.update(db, expense, data)
    return FixedExpenseOut.model_validate(updated)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fixed_expense(
    expense_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    expense = await _get_or_404(db, current_user.id, expense_id)
    await FixedExpenseService.delete(db, expense)
