# Gastos Fixos Mensais + Cálculo Automático de Meta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user register a list of monthly fixed expenses, and make every goal (`Goal`) automatically report how much the user must save per month to reach it by its target date — and whether that's feasible given income minus fixed expenses.

**Architecture:** New `FixedExpense` model/CRUD mirrors the existing `Goal` CRUD exactly (model → schema → service → router). A new pure function `compute_savings_plan` (no I/O) computes the savings plan from a goal's amounts/date plus a caller-supplied `disposable_income`; the `goals` endpoints compute `disposable_income = monthly_income - total_fixed_expenses` per request and attach the plan to every `GoalOut` response, so it's always fresh, not frozen at creation time. Frontend gets a new `/gastos-fixos` page (also used as a skippable post-registration onboarding step), and `Goals.jsx` renders the computed fields already present on every goal.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 + SQLite (dev) on the backend; React 18 + Vite + React Router 6 on the frontend. Backend tests: pytest + pytest-asyncio + httpx (ASGI transport), added fresh — no test framework exists yet on either side.

**Spec:** `docs/superpowers/specs/2026-09-17-gastos-fixos-e-meta-design.md`

## Global Constraints

- New table only — do **not** touch `budget_service.py` or the existing 50/30/20 ceiling logic; fixed expenses feed only the goal savings-plan calculation.
- No Alembic migration needed: `fixed_expenses` is a brand-new table, created automatically by the existing `Base.metadata.create_all` on startup (`backend/app/main.py`). Do not modify `main.py`.
- Backend: follow the exact static-method service pattern already used by `GoalService`/`CategoryService` (see `backend/app/services/goal_service.py`).
- Frontend: reuse existing CSS classes only (`card`, `field`, `alert`, `alert info`, `btn`, `btn small`, `btn secondary`, `goal-card`, `goal-head`, `goal-name`, `goal-amounts`, `empty`, `empty-ic`, `card-title`, `tnum`, `mt-16`, `row-between`, `spinner`, `muted`) — no new CSS, no new frontend test framework (no vitest/jest to be added).
- All UI copy in Portuguese (pt-BR), matching the existing tone (`Aluguel`, `Gastos Fixos`, `Meu Bolso`, etc.).
- Money fields are `Decimal` end to end on the backend; FastAPI/Pydantic serialize `Decimal` as a JSON number (e.g. `1200.0`), not a string — tests must compare with `float(...)`, not string equality.
- Every backend task's tests use the shared `backend/tests/conftest.py` fixtures introduced in Task 1 (and extended in Task 3); do not create parallel/duplicate test infrastructure.

## Parallelization Plan

Tasks are grouped into batches. All tasks within a batch have no dependency on each other and can be dispatched concurrently (e.g. via `superpowers:dispatching-parallel-agents`); a batch starts only once every task in the previous batch it depends on has landed.

- **Batch A (no dependencies — start immediately):** Task 1, Task 4, Task 6, Task 8
- **Batch B (depends on Batch A):** Task 2 (needs Task 1), Task 7 (needs Task 6)
- **Batch C (depends on Batch B):** Task 3 (needs Task 2), Task 5 (needs Task 2 + Task 4), Task 9 (needs Task 7), Task 10 (needs Task 5 — code it in this batch, but run its manual verification only after Task 5 has actually landed)
- **Batch D (sequential, after everything else lands):** Task 11 (full manual end-to-end validation)

---

### Task 1: `FixedExpense` model + backend test infrastructure

**Files:**
- Create: `backend/app/models/fixed_expense.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/user.py`
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_fixed_expense_model.py`

**Interfaces:**
- Consumes: `app.core.database.Base`, `app.core.types.GUID` (existing).
- Produces: `app.models.fixed_expense.FixedExpense` (columns `id`, `user_id`, `name`, `amount`, `created_at`); `User.fixed_expenses` relationship; the `db_session` pytest fixture (an `AsyncSession` backed by an in-memory SQLite DB with all tables created), reused by every later backend task's tests.

- [ ] **Step 1: Add test dependencies to `requirements.txt`**

Append to `backend/requirements.txt`:

```
pytest>=8.2.0
pytest-asyncio>=0.23.6
httpx>=0.27.0
```

- [ ] **Step 2: Install dependencies**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pip install -r requirements.txt
```

- [ ] **Step 3: Create pytest config**

Create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 4: Create test package and shared `db_session` fixture**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/conftest.py`:

```python
from collections.abc import AsyncGenerator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        future=True,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
    await engine.dispose()
```

- [ ] **Step 5: Write the failing test**

Create `backend/tests/test_fixed_expense_model.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixed_expense import FixedExpense
from app.models.user import User


async def test_create_and_read_fixed_expense(db_session: AsyncSession):
    user = User(
        username="ana",
        email="ana@example.com",
        password_hash="hashed",
        monthly_income=Decimal("5000.00"),
    )
    db_session.add(user)
    await db_session.flush()

    expense = FixedExpense(user_id=user.id, name="Aluguel", amount=Decimal("1200.00"))
    db_session.add(expense)
    await db_session.commit()

    result = await db_session.execute(
        select(FixedExpense).where(FixedExpense.user_id == user.id)
    )
    saved = result.scalar_one()
    assert saved.name == "Aluguel"
    assert saved.amount == Decimal("1200.00")
    assert isinstance(saved.id, uuid.UUID)


async def test_deleting_user_cascades_to_fixed_expenses(db_session: AsyncSession):
    user = User(
        username="bia",
        email="bia@example.com",
        password_hash="hashed",
        monthly_income=Decimal("4000.00"),
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        FixedExpense(user_id=user.id, name="Internet", amount=Decimal("100.00"))
    )
    await db_session.commit()

    await db_session.delete(user)
    await db_session.commit()

    result = await db_session.execute(select(FixedExpense))
    assert result.scalar_one_or_none() is None
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_fixed_expense_model.py -v
```

Expected: FAIL / collection error — `ModuleNotFoundError: No module named 'app.models.fixed_expense'`.

- [ ] **Step 7: Implement the model**

Create `backend/app/models/fixed_expense.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class FixedExpense(Base):
    """A recurring monthly expense the user commits to (e.g. rent, internet)."""

    __tablename__ = "fixed_expenses"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now()
    )

    user: Mapped["User"] = relationship(back_populates="fixed_expenses")  # noqa: F821
```

Modify `backend/app/models/user.py` — add the relationship right after the existing `categories` relationship (inside the `User` class):

```python
    categories: Mapped[list["Category"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    fixed_expenses: Mapped[list["FixedExpense"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
```

Modify `backend/app/models/__init__.py` to:

```python
"""Import all models so SQLAlchemy's metadata is fully populated."""

from app.models.category import Category
from app.models.fixed_expense import FixedExpense
from app.models.goal import Goal
from app.models.transaction import Transaction, TransactionType
from app.models.user import BudgetMode, User

__all__ = [
    "User",
    "BudgetMode",
    "Transaction",
    "TransactionType",
    "Category",
    "Goal",
    "FixedExpense",
]
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_fixed_expense_model.py -v
```

Expected: 2 passed.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/joaod/finance_app && git add backend/requirements.txt backend/pytest.ini backend/tests backend/app/models/fixed_expense.py backend/app/models/__init__.py backend/app/models/user.py && git commit -m "$(cat <<'EOF'
Adiciona modelo FixedExpense e infraestrutura de testes do backend

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fixed expense schemas + service

**Files:**
- Create: `backend/app/schemas/fixed_expense.py`
- Create: `backend/app/services/fixed_expense_service.py`
- Test: `backend/tests/test_fixed_expense_service.py`

**Interfaces:**
- Consumes: `app.models.fixed_expense.FixedExpense` (Task 1), `db_session` fixture (Task 1).
- Produces: `FixedExpenseCreate{name, amount}`, `FixedExpenseUpdate{name?, amount?}`, `FixedExpenseOut{id, name, amount, created_at}` schemas; `FixedExpenseService.create/get/list/update/delete/total_for_user(db, user_id) -> Decimal` — `total_for_user` is consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_fixed_expense_service.py`:

```python
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.fixed_expense import FixedExpenseCreate, FixedExpenseUpdate
from app.services.fixed_expense_service import FixedExpenseService


async def _make_user(db_session: AsyncSession) -> User:
    user = User(
        username="carla",
        email="carla@example.com",
        password_hash="hashed",
        monthly_income=Decimal("4500.00"),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_create_and_list(db_session: AsyncSession):
    user = await _make_user(db_session)
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Aluguel", amount=Decimal("1200.00"))
    )
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Internet", amount=Decimal("100.00"))
    )

    items = await FixedExpenseService.list(db_session, user.id)
    assert [item.name for item in items] == ["Aluguel", "Internet"]


async def test_update_changes_only_given_fields(db_session: AsyncSession):
    user = await _make_user(db_session)
    expense = await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Streaming", amount=Decimal("40.00"))
    )

    updated = await FixedExpenseService.update(
        db_session, expense, FixedExpenseUpdate(amount=Decimal("55.00"))
    )

    assert updated.name == "Streaming"
    assert updated.amount == Decimal("55.00")


async def test_delete_removes_expense(db_session: AsyncSession):
    user = await _make_user(db_session)
    expense = await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Água", amount=Decimal("60.00"))
    )

    await FixedExpenseService.delete(db_session, expense)

    assert await FixedExpenseService.get(db_session, user.id, expense.id) is None


async def test_total_for_user_sums_all_amounts(db_session: AsyncSession):
    user = await _make_user(db_session)
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Aluguel", amount=Decimal("1200.00"))
    )
    await FixedExpenseService.create(
        db_session, user.id, FixedExpenseCreate(name="Internet", amount=Decimal("100.50"))
    )

    total = await FixedExpenseService.total_for_user(db_session, user.id)

    assert total == Decimal("1300.50")


async def test_total_for_user_with_no_expenses_is_zero(db_session: AsyncSession):
    user = await _make_user(db_session)

    total = await FixedExpenseService.total_for_user(db_session, user.id)

    assert total == Decimal("0")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_fixed_expense_service.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.fixed_expense'`.

- [ ] **Step 3: Implement the schemas**

Create `backend/app/schemas/fixed_expense.py`:

```python
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class FixedExpenseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)


class FixedExpenseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    amount: Decimal | None = Field(default=None, gt=0)


class FixedExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    amount: Decimal
    created_at: datetime
```

- [ ] **Step 4: Implement the service**

Create `backend/app/services/fixed_expense_service.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixed_expense import FixedExpense
from app.schemas.fixed_expense import FixedExpenseCreate, FixedExpenseUpdate


class FixedExpenseService:
    @staticmethod
    async def create(
        db: AsyncSession, user_id: uuid.UUID, data: FixedExpenseCreate
    ) -> FixedExpense:
        expense = FixedExpense(user_id=user_id, name=data.name, amount=data.amount)
        db.add(expense)
        await db.commit()
        await db.refresh(expense)
        return expense

    @staticmethod
    async def get(
        db: AsyncSession, user_id: uuid.UUID, expense_id: uuid.UUID
    ) -> FixedExpense | None:
        query = select(FixedExpense).where(
            FixedExpense.id == expense_id, FixedExpense.user_id == user_id
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list(db: AsyncSession, user_id: uuid.UUID) -> list[FixedExpense]:
        query = (
            select(FixedExpense)
            .where(FixedExpense.user_id == user_id)
            .order_by(FixedExpense.created_at)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update(
        db: AsyncSession, expense: FixedExpense, data: FixedExpenseUpdate
    ) -> FixedExpense:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(expense, field, value)
        await db.commit()
        await db.refresh(expense)
        return expense

    @staticmethod
    async def delete(db: AsyncSession, expense: FixedExpense) -> None:
        await db.delete(expense)
        await db.commit()

    @staticmethod
    async def total_for_user(db: AsyncSession, user_id: uuid.UUID) -> Decimal:
        query = select(func.coalesce(func.sum(FixedExpense.amount), 0)).where(
            FixedExpense.user_id == user_id
        )
        result = await db.execute(query)
        return Decimal(str(result.scalar() or 0))
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_fixed_expense_service.py -v
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/joaod/finance_app && git add backend/app/schemas/fixed_expense.py backend/app/services/fixed_expense_service.py backend/tests/test_fixed_expense_service.py && git commit -m "$(cat <<'EOF'
Adiciona schemas e service de gastos fixos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fixed expenses REST endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/fixed_expenses.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_fixed_expenses_api.py`

**Interfaces:**
- Consumes: `FixedExpenseService` (Task 2), `CurrentUser`/`DbSession` (`app.api.deps`, existing).
- Produces: `POST/GET /api/v1/fixed-expenses`, `PATCH/DELETE /api/v1/fixed-expenses/{id}`; the `client` and `auth_headers` pytest fixtures, reused by Task 5's tests.

- [ ] **Step 1: Extend `conftest.py` with an authenticated HTTP client fixture**

Append to `backend/tests/conftest.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app as fastapi_app


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "tester",
            "email": "tester@example.com",
            "password": "senha123",
            "monthly_income": "3000.00",
        },
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_fixed_expenses_api.py`:

```python
from httpx import AsyncClient


async def test_create_list_update_delete_fixed_expense(
    client: AsyncClient, auth_headers: dict[str, str]
):
    create_resp = await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1200.00"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == "Aluguel"
    assert float(created["amount"]) == 1200.0

    list_resp = await client.get("/api/v1/fixed-expenses", headers=auth_headers)
    assert list_resp.status_code == 200
    assert [item["name"] for item in list_resp.json()] == ["Aluguel"]

    update_resp = await client.patch(
        f"/api/v1/fixed-expenses/{created['id']}",
        json={"amount": "1300.00"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert float(update_resp.json()["amount"]) == 1300.0

    delete_resp = await client.delete(
        f"/api/v1/fixed-expenses/{created['id']}", headers=auth_headers
    )
    assert delete_resp.status_code == 204

    final_list = await client.get("/api/v1/fixed-expenses", headers=auth_headers)
    assert final_list.json() == []


async def test_cannot_modify_another_users_fixed_expense(client: AsyncClient):
    resp_a = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "userA",
            "email": "usera@example.com",
            "password": "senha123",
            "monthly_income": "3000.00",
        },
    )
    token_a = resp_a.json()["access_token"]
    create_resp = await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1000.00"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    expense_id = create_resp.json()["id"]

    resp_b = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "userB",
            "email": "userb@example.com",
            "password": "senha123",
            "monthly_income": "2000.00",
        },
    )
    token_b = resp_b.json()["access_token"]

    patch_resp = await client.patch(
        f"/api/v1/fixed-expenses/{expense_id}",
        json={"amount": "1.00"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert patch_resp.status_code == 404
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_fixed_expenses_api.py -v
```

Expected: FAIL — 404 Not Found (route doesn't exist yet).

- [ ] **Step 4: Implement the endpoints**

Create `backend/app/api/v1/endpoints/fixed_expenses.py`:

```python
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
```

Modify `backend/app/api/v1/router.py` to:

```python
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    dashboard,
    fixed_expenses,
    goals,
    transactions,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(goals.router)
api_router.include_router(fixed_expenses.router)
api_router.include_router(dashboard.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_fixed_expenses_api.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Run the full backend test suite**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest -v
```

Expected: all tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/joaod/finance_app && git add backend/app/api/v1/endpoints/fixed_expenses.py backend/app/api/v1/router.py backend/tests/conftest.py backend/tests/test_fixed_expenses_api.py && git commit -m "$(cat <<'EOF'
Adiciona endpoints REST de gastos fixos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Pure savings-plan calculation

**Files:**
- Create: `backend/app/services/goal_planning.py`
- Test: `backend/tests/test_goal_planning.py`

**Interfaces:**
- Consumes: nothing (pure function, no DB, no other app modules besides stdlib `datetime`/`decimal`).
- Produces: `SavingsPlan(monthly_amount_needed: Decimal | None, months_remaining: int | None, is_feasible: bool | None, savings_shortfall: Decimal | None)` and `compute_savings_plan(*, target_amount: Decimal, current_amount: Decimal, target_date: date | None, is_completed: bool, disposable_income: Decimal, today: date | None = None) -> SavingsPlan` — consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_goal_planning.py`:

```python
from datetime import date
from decimal import Decimal

from app.services.goal_planning import compute_savings_plan


def test_no_target_date_returns_empty_plan():
    plan = compute_savings_plan(
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("200.00"),
        target_date=None,
        is_completed=False,
        disposable_income=Decimal("500.00"),
    )
    assert plan.monthly_amount_needed is None
    assert plan.months_remaining is None
    assert plan.is_feasible is None
    assert plan.savings_shortfall is None


def test_completed_goal_returns_empty_plan_even_with_target_date():
    plan = compute_savings_plan(
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("1000.00"),
        target_date=date(2027, 1, 1),
        is_completed=True,
        disposable_income=Decimal("500.00"),
    )
    assert plan.monthly_amount_needed is None


def test_feasible_goal_a_few_months_out():
    plan = compute_savings_plan(
        target_amount=Decimal("3000.00"),
        current_amount=Decimal("0.00"),
        target_date=date(2027, 3, 17),
        is_completed=False,
        disposable_income=Decimal("600.00"),
        today=date(2026, 9, 17),
    )
    assert plan.months_remaining == 6
    assert plan.monthly_amount_needed == Decimal("500.00")
    assert plan.is_feasible is True
    assert plan.savings_shortfall == Decimal("0")


def test_infeasible_goal_reports_shortfall():
    plan = compute_savings_plan(
        target_amount=Decimal("3000.00"),
        current_amount=Decimal("0.00"),
        target_date=date(2027, 3, 17),
        is_completed=False,
        disposable_income=Decimal("300.00"),
        today=date(2026, 9, 17),
    )
    assert plan.monthly_amount_needed == Decimal("500.00")
    assert plan.is_feasible is False
    assert plan.savings_shortfall == Decimal("200.00")


def test_target_date_already_past_treats_as_due_now():
    plan = compute_savings_plan(
        target_amount=Decimal("500.00"),
        current_amount=Decimal("100.00"),
        target_date=date(2026, 1, 1),
        is_completed=False,
        disposable_income=Decimal("1000.00"),
        today=date(2026, 9, 17),
    )
    assert plan.months_remaining == 1
    assert plan.monthly_amount_needed == Decimal("400.00")
    assert plan.is_feasible is True


def test_current_amount_already_exceeds_target_but_not_flagged_completed():
    plan = compute_savings_plan(
        target_amount=Decimal("500.00"),
        current_amount=Decimal("600.00"),
        target_date=date(2027, 1, 1),
        is_completed=False,
        disposable_income=Decimal("0.00"),
        today=date(2026, 9, 17),
    )
    assert plan.monthly_amount_needed == Decimal("0.00")
    assert plan.is_feasible is True
    assert plan.savings_shortfall == Decimal("0")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_goal_planning.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.goal_planning'`.

- [ ] **Step 3: Implement `compute_savings_plan`**

Create `backend/app/services/goal_planning.py`:

```python
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class SavingsPlan:
    monthly_amount_needed: Decimal | None
    months_remaining: int | None
    is_feasible: bool | None
    savings_shortfall: Decimal | None


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _months_between(today: date, target_date: date) -> int:
    """Whole months from today to target_date, rounded up, minimum 1."""
    months = (target_date.year - today.year) * 12 + (target_date.month - today.month)
    if target_date.day > today.day:
        months += 1
    return max(months, 1)


def compute_savings_plan(
    *,
    target_amount: Decimal,
    current_amount: Decimal,
    target_date: date | None,
    is_completed: bool,
    disposable_income: Decimal,
    today: date | None = None,
) -> SavingsPlan:
    """How much the user must save per month to reach a goal by its target date."""
    if is_completed or target_date is None:
        return SavingsPlan(
            monthly_amount_needed=None,
            months_remaining=None,
            is_feasible=None,
            savings_shortfall=None,
        )

    today = today or date.today()
    remaining_amount = target_amount - current_amount
    if remaining_amount < 0:
        remaining_amount = Decimal("0")

    months_remaining = _months_between(today, target_date)
    monthly_amount_needed = _quantize(remaining_amount / Decimal(months_remaining))

    is_feasible = disposable_income >= monthly_amount_needed
    shortfall = monthly_amount_needed - disposable_income
    savings_shortfall = _quantize(shortfall) if shortfall > 0 else Decimal("0")

    return SavingsPlan(
        monthly_amount_needed=monthly_amount_needed,
        months_remaining=months_remaining,
        is_feasible=is_feasible,
        savings_shortfall=savings_shortfall,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_goal_planning.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/joaod/finance_app && git add backend/app/services/goal_planning.py backend/tests/test_goal_planning.py && git commit -m "$(cat <<'EOF'
Adiciona cálculo puro do plano de economia de uma meta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire the savings plan into `GoalOut` and the `/goals` endpoints

**Files:**
- Modify: `backend/app/schemas/goal.py`
- Modify: `backend/app/api/v1/endpoints/goals.py`
- Test: `backend/tests/test_goals_savings_plan_api.py`

**Interfaces:**
- Consumes: `compute_savings_plan`/`SavingsPlan` (Task 4), `FixedExpenseService.total_for_user` (Task 2), `client`/`auth_headers` fixtures (Task 3).
- Produces: `GoalOut` gains `disposable_income: Decimal`, `monthly_amount_needed: Decimal | None`, `months_remaining: int | None`, `is_feasible: bool | None`, `savings_shortfall: Decimal | None`, and classmethod `GoalOut.from_goal(goal: Goal, disposable_income: Decimal) -> GoalOut` — this exact response shape is consumed by Task 10 (frontend `Goals.jsx`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_goals_savings_plan_api.py`:

```python
from datetime import date, timedelta

from httpx import AsyncClient


async def _register(client: AsyncClient, email: str, income: str) -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": email.split("@")[0],
            "email": email,
            "password": "senha123",
            "monthly_income": income,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_goal_without_target_date_has_no_savings_plan(client: AsyncClient):
    headers = await _register(client, "sem_data@example.com", "3000.00")

    resp = await client.post(
        "/api/v1/goals",
        json={"name": "Viagem", "target_amount": "1000.00"},
        headers=headers,
    )
    body = resp.json()

    assert body["monthly_amount_needed"] is None
    assert body["is_feasible"] is None


async def test_goal_with_target_date_computes_feasible_plan(client: AsyncClient):
    headers = await _register(client, "feasivel@example.com", "3000.00")
    await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1000.00"},
        headers=headers,
    )
    target_date = (date.today() + timedelta(days=59)).isoformat()

    resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "2000.00", "target_date": target_date},
        headers=headers,
    )
    body = resp.json()

    assert float(body["disposable_income"]) == 2000.0
    assert body["is_feasible"] is True
    assert float(body["savings_shortfall"]) == 0.0


async def test_goal_with_target_date_computes_infeasible_plan(client: AsyncClient):
    headers = await _register(client, "inviavel@example.com", "1000.00")
    await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "900.00"},
        headers=headers,
    )
    target_date = (date.today() + timedelta(days=20)).isoformat()

    resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "5000.00", "target_date": target_date},
        headers=headers,
    )
    body = resp.json()

    assert float(body["disposable_income"]) == 100.0
    assert body["is_feasible"] is False
    assert float(body["savings_shortfall"]) > 0


async def test_updating_fixed_expenses_changes_goal_plan_on_next_fetch(client: AsyncClient):
    headers = await _register(client, "atualiza@example.com", "2000.00")
    target_date = (date.today() + timedelta(days=30)).isoformat()
    create_resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "2000.00", "target_date": target_date},
        headers=headers,
    )
    goal_id = create_resp.json()["id"]
    assert create_resp.json()["is_feasible"] is True

    await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1900.00"},
        headers=headers,
    )

    refreshed = await client.get(f"/api/v1/goals/{goal_id}", headers=headers)
    assert refreshed.json()["is_feasible"] is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_goals_savings_plan_api.py -v
```

Expected: FAIL — `KeyError`/`AssertionError` (`monthly_amount_needed` etc. not present on the current `GoalOut`).

- [ ] **Step 3: Extend `GoalOut` with the savings plan**

Modify `backend/app/schemas/goal.py` to (full file):

```python
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.goal import Goal
from app.services.goal_planning import compute_savings_plan


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: Decimal = Field(gt=0)
    current_amount: Decimal = Field(default=Decimal("0"), ge=0)
    target_date: date | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target_amount: Decimal | None = Field(default=None, gt=0)
    current_amount: Decimal | None = Field(default=None, ge=0)
    target_date: date | None = None
    is_completed: bool | None = None


class GoalContribution(BaseModel):
    """Add (or subtract, if negative) an amount to a goal's accumulated value."""

    amount: Decimal = Field(description="Amount to add to current_amount")


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    is_completed: bool
    created_at: datetime

    disposable_income: Decimal = Decimal("0")
    monthly_amount_needed: Decimal | None = None
    months_remaining: int | None = None
    is_feasible: bool | None = None
    savings_shortfall: Decimal | None = None

    @computed_field
    @property
    def progress_percent(self) -> float:
        """Progress toward the target, clamped to 0–100 (for the progress bar)."""
        if self.target_amount <= 0:
            return 0.0
        pct = float(self.current_amount) / float(self.target_amount) * 100
        return round(min(max(pct, 0.0), 100.0), 2)

    @computed_field
    @property
    def remaining_amount(self) -> Decimal:
        remaining = self.target_amount - self.current_amount
        return remaining if remaining > 0 else Decimal("0")

    @classmethod
    def from_goal(cls, goal: Goal, disposable_income: Decimal) -> "GoalOut":
        """Build a GoalOut with the savings plan computed from disposable_income."""
        plan = compute_savings_plan(
            target_amount=Decimal(goal.target_amount),
            current_amount=Decimal(goal.current_amount),
            target_date=goal.target_date,
            is_completed=goal.is_completed,
            disposable_income=disposable_income,
        )
        out = cls.model_validate(goal)
        return out.model_copy(
            update={
                "disposable_income": disposable_income,
                "monthly_amount_needed": plan.monthly_amount_needed,
                "months_remaining": plan.months_remaining,
                "is_feasible": plan.is_feasible,
                "savings_shortfall": plan.savings_shortfall,
            }
        )
```

- [ ] **Step 4: Use `GoalOut.from_goal` in every `/goals` endpoint**

Modify `backend/app/api/v1/endpoints/goals.py` (full file):

```python
import uuid
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.goal import (
    GoalContribution,
    GoalCreate,
    GoalOut,
    GoalUpdate,
)
from app.services.fixed_expense_service import FixedExpenseService
from app.services.goal_service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


async def _disposable_income(db: DbSession, user: User) -> Decimal:
    total_fixed = await FixedExpenseService.total_for_user(db, user.id)
    income = Decimal(user.monthly_income or 0)
    disposable = income - total_fixed
    return disposable if disposable > 0 else Decimal("0")


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate, current_user: CurrentUser, db: DbSession
) -> GoalOut:
    """RF04 — Create a savings/investment goal (e.g. Emergency Fund)."""
    goal = await GoalService.create(db, current_user.id, data)
    disposable_income = await _disposable_income(db, current_user)
    return GoalOut.from_goal(goal, disposable_income)


@router.get("", response_model=list[GoalOut])
async def list_goals(current_user: CurrentUser, db: DbSession) -> list[GoalOut]:
    goals = await GoalService.list(db, current_user.id)
    disposable_income = await _disposable_income(db, current_user)
    return [GoalOut.from_goal(g, disposable_income) for g in goals]


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
    disposable_income = await _disposable_income(db, current_user)
    return GoalOut.from_goal(goal, disposable_income)


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: uuid.UUID,
    data: GoalUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalOut:
    goal = await _get_or_404(db, current_user.id, goal_id)
    updated = await GoalService.update(db, goal, data)
    disposable_income = await _disposable_income(db, current_user)
    return GoalOut.from_goal(updated, disposable_income)


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
    disposable_income = await _disposable_income(db, current_user)
    return GoalOut.from_goal(updated, disposable_income)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    goal = await _get_or_404(db, current_user.id, goal_id)
    await GoalService.delete(db, goal)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest tests/test_goals_savings_plan_api.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Run the full backend test suite**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest -v
```

Expected: all tests pass (no regressions in existing goal behavior).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/joaod/finance_app && git add backend/app/schemas/goal.py backend/app/api/v1/endpoints/goals.py backend/tests/test_goals_savings_plan_api.py && git commit -m "$(cat <<'EOF'
Calcula o plano de economia (quanto guardar/mês) em cada meta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Frontend API client methods for fixed expenses

**Files:**
- Modify: `frontend/src/api/client.js`

**Interfaces:**
- Consumes: existing `request()` helper (`frontend/src/api/client.js`).
- Produces: `api.getFixedExpenses()`, `api.createFixedExpense(payload)`, `api.updateFixedExpense(id, payload)`, `api.deleteFixedExpense(id)` — consumed by Task 7.

- [ ] **Step 1: Add the fixed-expenses methods**

Modify `frontend/src/api/client.js` — insert this block right after the `// Goals` section and before `// Dashboard`:

```js
  // Fixed expenses
  getFixedExpenses: () => request('/fixed-expenses'),
  createFixedExpense: (payload) =>
    request('/fixed-expenses', { method: 'POST', body: payload }),
  updateFixedExpense: (id, payload) =>
    request(`/fixed-expenses/${id}`, { method: 'PATCH', body: payload }),
  deleteFixedExpense: (id) =>
    request(`/fixed-expenses/${id}`, { method: 'DELETE' }),

```

- [ ] **Step 2: Manual verification**

With Task 3's backend already running (`cd backend && source venv/Scripts/activate && uvicorn app.main:app --reload`) and the frontend dev server running (`cd frontend && npm run dev`), open http://localhost:5173, log in with an existing account, open the browser DevTools console and run:

```js
await api.getFixedExpenses()          // expect: []
await api.createFixedExpense({ name: 'Teste', amount: 10 })  // expect: the created object, with an id
await api.getFixedExpenses()          // expect: an array with one item
await api.deleteFixedExpense((await api.getFixedExpenses())[0].id)  // expect: null (204)
```

Confirm each call returns the expected shape with no thrown errors.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/joaod/finance_app && git add frontend/src/api/client.js && git commit -m "$(cat <<'EOF'
Adiciona métodos de API para gastos fixos no client do frontend

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `FixedExpenses.jsx` page + route

**Files:**
- Create: `frontend/src/pages/FixedExpenses.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `api.getFixedExpenses/createFixedExpense/updateFixedExpense/deleteFixedExpense` (Task 6), `Modal` (`frontend/src/components/Modal.jsx`, existing), `formatCurrency` (`frontend/src/utils/format.js`, existing).
- Produces: route `/gastos-fixos` (rendered inside the authenticated `Layout`), which supports `?onboarding=1` to show a skip/finish banner — consumed by Task 8 (redirect target) and Task 9 (link target).

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/FixedExpenses.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Wallet, Trash2, Pencil } from 'lucide-react'
import { api } from '../api/client'
import Modal from '../components/Modal.jsx'
import { formatCurrency } from '../utils/format'

function FixedExpenseModal({ expense, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: expense?.name ?? '',
    amount: expense ? String(expense.amount) : '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amount = parseFloat(String(form.amount).replace(',', '.'))
    if (!amount || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), amount }
      if (expense) {
        await api.updateFixedExpense(expense.id, payload)
      } else {
        await api.createFixedExpense(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar gasto fixo' : 'Novo gasto fixo'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}
        <div className="field">
          <label>Nome do gasto</label>
          <input
            value={form.name}
            onChange={set('name')}
            required
            maxLength={100}
            placeholder="Ex: Aluguel"
          />
        </div>
        <div className="field">
          <label>Valor mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={set('amount')}
            required
            placeholder="Ex: 1200,00"
          />
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}

export default function FixedExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isOnboarding = searchParams.get('onboarding') === '1'

  async function load() {
    setLoading(true)
    setExpenses(await api.getFixedExpenses())
    setLoading(false)
  }
  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  async function remove(item) {
    if (!confirm(`Excluir "${item.name}"?`)) return
    await api.deleteFixedExpense(item.id)
    setExpenses((prev) => prev.filter((x) => x.id !== item.id))
  }

  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0)

  return (
    <>
      {isOnboarding && (
        <div className="alert info mt-16">
          Antes de começar, quais são seus gastos fixos mensais? Isso ajuda o
          app a calcular quanto você pode guardar por mês em cada meta.
        </div>
      )}

      <div className="card mt-16">
        <div className="row-between">
          <h2 className="card-title"><Wallet size={18} /> Total mensal</h2>
          <span className="tnum">{formatCurrency(total)}</span>
        </div>
      </div>

      <button
        className="btn"
        style={{ marginTop: 16 }}
        onClick={() => { setEditing(null); setShowForm(true) }}
      >
        <Plus size={18} /> Novo gasto fixo
      </button>

      {loading ? (
        <div className="spinner" />
      ) : expenses.length === 0 ? (
        <div className="card empty mt-16">
          <div className="empty-ic"><Wallet size={26} /></div>
          Você ainda não cadastrou gastos fixos.
          <br />
          Ex: aluguel, internet, streaming, plano de saúde.
        </div>
      ) : (
        <div className="mt-16">
          {expenses.map((item) => (
            <div className="card goal-card" key={item.id}>
              <div className="goal-head">
                <span className="goal-name">{item.name}</span>
                <span className="tnum">{formatCurrency(item.amount)}</span>
              </div>
              <div className="row-between mt-16" style={{ gap: 8 }}>
                <button
                  className="btn small secondary"
                  onClick={() => { setEditing(item); setShowForm(true) }}
                >
                  <Pencil size={15} /> Editar
                </button>
                <button
                  className="btn small secondary"
                  style={{ color: 'var(--expense)' }}
                  onClick={() => remove(item)}
                >
                  <Trash2 size={15} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOnboarding && (
        <div className="row-between mt-16" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={() => navigate('/')}>
            Pular por agora
          </button>
          <button className="btn" onClick={() => navigate('/')}>
            Concluir e ir para o Dashboard
          </button>
        </div>
      )}

      {showForm && (
        <FixedExpenseModal
          expense={editing}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Register the route**

Modify `frontend/src/App.jsx` to:

```jsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Goals from './pages/Goals.jsx'
import FixedExpenses from './pages/FixedExpenses.jsx'
import Settings from './pages/Settings.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner" />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/gastos-fixos" element={<FixedExpenses />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Manual verification (browser automation via `claude-in-chrome`)**

With both dev servers running, use the `claude-in-chrome` skill to: log in with an existing account, navigate directly to `http://localhost:5173/gastos-fixos`, click "Novo gasto fixo", create an item named "Aluguel" with amount `1200`, confirm it appears in the list and the total updates to `R$ 1.200,00`, click "Editar" and change the amount to `1300`, confirm the card and total update, then click "Excluir" and confirm the item and total go back to empty/`R$ 0,00`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/joaod/finance_app && git add frontend/src/pages/FixedExpenses.jsx frontend/src/App.jsx && git commit -m "$(cat <<'EOF'
Adiciona página de Gastos Fixos e rota /gastos-fixos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Post-registration onboarding redirect

**Files:**
- Modify: `frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `useAuth().register` (`frontend/src/context/AuthContext.jsx`, existing, unchanged), `useNavigate` (`react-router-dom`).
- Produces: after a successful registration, the app navigates to `/gastos-fixos?onboarding=1` — this route is provided by Task 7; this task can be implemented and committed independently of Task 7's landing order since the target is just a URL string.

- [ ] **Step 1: Add the post-registration redirect**

Modify `frontend/src/pages/Register.jsx` (full file):

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    monthly_income: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        monthly_income: form.monthly_income
          ? parseFloat(String(form.monthly_income).replace(',', '.'))
          : 0,
      })
      navigate('/gastos-fixos?onboarding=1', { replace: true })
    } catch (err) {
      setError(err.message || 'Não foi possível criar a conta.')
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div className="brand-badge">💰</div>
        <h1>Criar conta</h1>
        <p>Comece a organizar sua vida financeira hoje.</p>
      </div>

      <form onSubmit={submit} className="card">
        {error && <div className="alert">{error}</div>}
        <div className="field">
          <label>Nome de usuário</label>
          <input
            type="text"
            value={form.username}
            onChange={set('username')}
            required
            minLength={3}
            placeholder="Como quer ser chamado?"
          />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={form.email} onChange={set('email')} required placeholder="voce@email.com" />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div className="field">
          <label>Renda mensal (opcional)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.monthly_income}
            onChange={set('monthly_income')}
            placeholder="Ex: 3000,00"
          />
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <p className="auth-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

This can only be confirmed end-to-end once Task 7's route exists — covered by Task 11. For now, confirm via code review that `navigate('/gastos-fixos?onboarding=1', { replace: true })` runs immediately after a successful `register(...)` call and before any error handling.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/joaod/finance_app && git add frontend/src/pages/Register.jsx && git commit -m "$(cat <<'EOF'
Redireciona novo usuário para o onboarding de gastos fixos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Link to fixed expenses from Settings

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

**Interfaces:**
- Consumes: `/gastos-fixos` route (Task 7).
- Produces: a visible entry point to manage fixed expenses after onboarding, for returning users.

- [ ] **Step 1: Add the link**

Modify `frontend/src/pages/Settings.jsx`:

Change the import line:

```jsx
import { useState } from 'react'
```

to:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
```

Insert this new card right after the closing `</form>` of the "Renda & Orçamento" form and right before the `<div className="card mt-16">` that starts the "Aparência" section:

```jsx
      <div className="card mt-16">
        <div className="row-between">
          <div>
            <h2 className="card-title" style={{ marginBottom: 2 }}>
              <Wallet size={18} /> Gastos fixos
            </h2>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Aluguel, internet, streaming e outras contas mensais.
            </div>
          </div>
          <Link className="btn small secondary" to="/gastos-fixos">
            Gerenciar
          </Link>
        </div>
      </div>
```

- [ ] **Step 2: Manual verification (browser automation via `claude-in-chrome`)**

With both dev servers running, use `claude-in-chrome` to log in, go to `/settings`, confirm the new "Gastos fixos" card is visible with a "Gerenciar" button, click it, and confirm it navigates to `/gastos-fixos` (without the onboarding banner, since there's no `?onboarding=1`).

- [ ] **Step 3: Commit**

```bash
cd /c/Users/joaod/finance_app && git add frontend/src/pages/Settings.jsx && git commit -m "$(cat <<'EOF'
Adiciona link para gastos fixos na tela de Perfil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Show the savings plan on goal cards

**Files:**
- Modify: `frontend/src/pages/Goals.jsx`

**Interfaces:**
- Consumes: `monthly_amount_needed`, `is_feasible`, `savings_shortfall`, `target_date` fields on each `Goal` returned by `GET/POST /goals` (Task 5's `GoalOut` contract).
- Produces: visible savings-plan guidance and feasibility warning on each non-completed goal card with a `target_date`.

- [ ] **Step 1: Add the import and the new card content**

Modify `frontend/src/pages/Goals.jsx` — add `Link` to the existing import line:

```jsx
import { Link } from 'react-router-dom'
```

(insert this as a new line right after the existing `import { api } from '../api/client'` line).

Then, inside the goal-card `.map()`, replace this block:

```jsx
              {!g.is_completed && (
                <div className="goal-amounts" style={{ marginTop: 2 }}>
                  <span className="tnum">Faltam {formatCurrency(g.remaining_amount)}</span>
                  {g.target_date && <span>até {formatDate(g.target_date)}</span>}
                </div>
              )}
```

with:

```jsx
              {!g.is_completed && (
                <div className="goal-amounts" style={{ marginTop: 2 }}>
                  <span className="tnum">Faltam {formatCurrency(g.remaining_amount)}</span>
                  {g.target_date && <span>até {formatDate(g.target_date)}</span>}
                </div>
              )}
              {!g.is_completed && g.target_date && g.monthly_amount_needed != null && (
                <>
                  <div className="goal-amounts" style={{ marginTop: 6 }}>
                    <span className="tnum">
                      Guarde {formatCurrency(g.monthly_amount_needed)}/mês até {formatDate(g.target_date)}
                    </span>
                  </div>
                  {g.is_feasible === false && (
                    <div className="alert mt-16" style={{ marginBottom: 0 }}>
                      Faltam {formatCurrency(g.savings_shortfall)}/mês para isso ser
                      viável com sua renda disponível atual. Considere ajustar o prazo
                      ou reduzir gastos fixos em{' '}
                      <Link to="/gastos-fixos">Gastos Fixos</Link>.
                    </div>
                  )}
                </>
              )}
```

- [ ] **Step 2: Manual verification (browser automation via `claude-in-chrome`) — run only after Task 5 has landed**

With both dev servers running, use `claude-in-chrome` to log in as a user with `monthly_income = 3000` and no fixed expenses, go to `/goals`, create a goal named "Reserva" with `target_amount = 6000` and a `target_date` 6 months out. Confirm the card shows "Guarde R$ 1.000,00/mês até [data]" with no warning (feasible, since disposable income is 3000). Then go to `/gastos-fixos`, add a fixed expense of `2500`, return to `/goals`, reload the page, and confirm the same card now shows the infeasibility warning with a shortfall amount and a working link back to "Gastos Fixos".

- [ ] **Step 3: Commit**

```bash
cd /c/Users/joaod/finance_app && git add frontend/src/pages/Goals.jsx && git commit -m "$(cat <<'EOF'
Exibe o plano de economia mensal e alerta de viabilidade nas metas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Full end-to-end manual validation

**Files:** none (validation only).

**Interfaces:**
- Consumes: the fully integrated app (Tasks 1–10).
- Produces: a confirmed working feature, or a bug report to fix before considering the plan complete.

- [ ] **Step 1: Start both servers**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && uvicorn app.main:app --reload
```

```bash
cd /c/Users/joaod/finance_app/frontend && npm run dev
```

- [ ] **Step 2: Run the full backend test suite one more time**

```bash
cd /c/Users/joaod/finance_app/backend && source venv/Scripts/activate && pytest -v
```

Expected: all tests pass.

- [ ] **Step 3: End-to-end walkthrough via `claude-in-chrome`**

Using the `claude-in-chrome` skill against `http://localhost:5173`:

1. Register a brand-new account (e.g. `email: e2e1@example.com`, `monthly_income: 4000`). Confirm the app redirects to `/gastos-fixos?onboarding=1` and shows the onboarding banner.
2. Add two fixed expenses: "Aluguel" (`1500`) and "Internet" (`120`). Confirm the total shows `R$ 1.620,00`.
3. Click "Concluir e ir para o Dashboard". Confirm it lands on `/`.
4. Go to "Metas", create a goal "Notebook novo", `target_amount = 4700`, `target_date` 5 months from today. Confirm the card shows a "Guarde R$ 940,00/mês até [data]" line with no infeasibility warning (disposable income `4000 - 1620 = 2380 ≥ 940`).
5. Edit that same goal's `target_date` to next month (via the API directly if there's no edit UI — `PATCH /api/v1/goals/{id}` — or skip this step if no edit UI exists) so the monthly amount needed exceeds `2380`, and confirm the infeasibility warning now appears with a shortfall value and a working link to "Gastos Fixos".
6. Register a second account and, at the onboarding screen, click "Pular por agora" instead of filling anything in. Confirm it lands on `/` directly, and that creating a goal with a `target_date` still works (with `disposable_income` equal to the full income, since there are no fixed expenses).
7. From "Perfil", confirm the "Gastos fixos → Gerenciar" link still opens `/gastos-fixos` (without the onboarding banner) for an already-onboarded account, and that editing/deleting an item there is reflected back on the "Metas" screen after a reload.

- [ ] **Step 4: Report results**

If every step above matches the expected behavior, the feature is complete. If any step fails, treat it as a bug: use `superpowers:systematic-debugging` to find the root cause, fix it in the relevant task's files, re-run that task's tests, and repeat this walkthrough from the affected step.
