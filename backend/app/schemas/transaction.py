import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.transaction import TransactionType
from app.schemas.category import CategoryOut


class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0, description="Positive amount; type sets the sign")
    type: TransactionType
    category_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=255)
    transaction_date: date | None = None


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    type: TransactionType | None = None
    category_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=255)
    transaction_date: date | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: Decimal
    type: TransactionType
    category_id: uuid.UUID | None
    category: CategoryOut | None
    description: str | None
    transaction_date: date
