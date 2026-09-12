import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.transaction import TransactionType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    type: TransactionType
    icon: str | None = Field(default=None, max_length=30)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: TransactionType
    icon: str | None
