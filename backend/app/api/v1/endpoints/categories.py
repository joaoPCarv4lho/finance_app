from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.models.transaction import TransactionType
from app.schemas.category import CategoryCreate, CategoryOut
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    current_user: CurrentUser,
    db: DbSession,
    type: TransactionType | None = None,
) -> list[CategoryOut]:
    categories = await CategoryService.list(db, current_user.id, type)
    return [CategoryOut.model_validate(c) for c in categories]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate, current_user: CurrentUser, db: DbSession
) -> CategoryOut:
    category = await CategoryService.create(
        db, current_user.id, data.name, data.type, data.icon
    )
    return CategoryOut.model_validate(category)
