import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models.transaction import TransactionType
from app.schemas.transaction import (
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
)
from app.services.category_service import CategoryService
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _validate_category(
    db, user_id: uuid.UUID, category_id: uuid.UUID | None
) -> None:
    if category_id is None:
        return
    category = await CategoryService.get(db, user_id, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada",
        )


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate, current_user: CurrentUser, db: DbSession
) -> TransactionOut:
    """RF02 — Register an Income, Expense or Investment quickly."""
    await _validate_category(db, current_user.id, data.category_id)
    transaction = await TransactionService.create(db, current_user.id, data)
    return TransactionOut.model_validate(transaction)


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    current_user: CurrentUser,
    db: DbSession,
    type: TransactionType | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TransactionOut]:
    transactions = await TransactionService.list(
        db,
        current_user.id,
        type_=type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return [TransactionOut.model_validate(t) for t in transactions]


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> TransactionOut:
    transaction = await TransactionService.get(db, current_user.id, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada"
        )
    return TransactionOut.model_validate(transaction)


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: uuid.UUID,
    data: TransactionUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> TransactionOut:
    transaction = await TransactionService.get(db, current_user.id, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada"
        )
    if "category_id" in data.model_dump(exclude_unset=True):
        await _validate_category(db, current_user.id, data.category_id)
    updated = await TransactionService.update(db, transaction, data)
    return TransactionOut.model_validate(updated)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    transaction = await TransactionService.get(db, current_user.id, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada"
        )
    await TransactionService.delete(db, transaction)
