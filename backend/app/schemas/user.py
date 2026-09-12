import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import BudgetMode


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)
    monthly_income: Decimal = Field(default=Decimal("0"), ge=0)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Update profile / budget settings. All fields optional."""

    username: str | None = Field(default=None, min_length=3, max_length=50)
    monthly_income: Decimal | None = Field(default=None, ge=0)
    budget_mode: BudgetMode | None = None
    monthly_budget: Decimal | None = Field(default=None, ge=0)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    monthly_income: Decimal
    budget_mode: BudgetMode
    monthly_budget: Decimal | None
    created_at: datetime
