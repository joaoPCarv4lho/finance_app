import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class BudgetMode(str, enum.Enum):
    """How the monthly spending ceiling is computed (RF03)."""

    RULE_50_30_20 = "RULE_50_30_20"  # 80% of income is spendable, 20% saved
    FREE = "FREE"  # user-defined monthly spending budget


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    monthly_income: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    budget_mode: Mapped[BudgetMode] = mapped_column(
        Enum(BudgetMode), default=BudgetMode.RULE_50_30_20, nullable=False
    )
    # Used only when budget_mode == FREE: the monthly spending ceiling.
    monthly_budget: Mapped[float | None] = mapped_column(Numeric(12, 2))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now()
    )

    transactions: Mapped[list["Transaction"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    goals: Mapped[list["Goal"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    fixed_expenses: Mapped[list["FixedExpense"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
