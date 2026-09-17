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
