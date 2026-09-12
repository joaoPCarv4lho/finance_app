from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select

from app.api.deps import DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.services.category_service import CategoryService

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token(user: User) -> Token:
    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DbSession) -> Token:
    """RF01 — Create an account with a bcrypt-hashed password."""
    existing = await db.execute(
        select(User).where(
            or_(User.email == data.email, User.username == data.username)
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail ou nome de usuário já cadastrado",
        )

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        monthly_income=data.monthly_income,
    )
    db.add(user)
    await db.flush()  # assign user.id before seeding categories
    await CategoryService.seed_defaults(db, user.id)
    await db.commit()
    await db.refresh(user)
    return _build_token(user)


@router.post("/login", response_model=Token)
async def login(
    db: DbSession,
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Token:
    """RF01 — Authenticate and receive a JWT.

    Uses the OAuth2 password form so Swagger's "Authorize" button works; pass
    your e-mail in the `username` field.
    """
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos",
        )
    return _build_token(user)


@router.post("/login/json", response_model=Token)
async def login_json(data: UserLogin, db: DbSession) -> Token:
    """RF01 — JSON login endpoint (convenient for SPA/mobile clients)."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos",
        )
    return _build_token(user)
