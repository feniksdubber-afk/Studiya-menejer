import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import (
    InitDataValidationError,
    create_access_token,
    decode_access_token,
    get_bearer_token,
    verify_init_data,
)
from db.session import get_db
from models.users import User
from schemas.auth import AuthResponse, TelegramAuthRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram", response_model=AuthResponse)
async def auth_telegram(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    """Mini App ochilganda chaqiriladi. Telegram initData'ni backendda
    kriptografik tekshiradi (frontendga hech qachon ishonilmaydi), so'ng
    mavjud userni topadi yoki yangi (ro'yxatdan hali to'liq o'tmagan)
    user yozuvini yaratadi va JWT qaytaradi.
    """
    try:
        tg_user = verify_init_data(
            payload.init_data,
            bot_token=settings.bot_token,
            max_age_seconds=settings.init_data_max_age_seconds,
        )
    except InitDataValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"initData tekshiruvidan o'tmadi: {exc}",
        ) from exc

    result = await db.execute(select(User).where(User.telegram_id == tg_user.telegram_id))
    user = result.scalar_one_or_none()
    is_new_user = False

    if user is None:
        user = User(
            id=uuid.uuid4(),
            telegram_id=tg_user.telegram_id,
            first_name=tg_user.first_name or "—",
            last_name=tg_user.last_name,
            telegram_username=tg_user.username,
            role=None,
            is_registered=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        is_new_user = True
    else:
        # Telegram profilidagi o'zgarishlarni (username, ism) sinxronlab boramiz
        changed = False
        if tg_user.username != user.telegram_username:
            user.telegram_username = tg_user.username
            changed = True
        if tg_user.first_name and tg_user.first_name != user.first_name and not user.is_registered:
            # is_registered bo'lsa, foydalanuvchi tizimda o'z ismini o'zgartirgan
            # bo'lishi mumkin — Telegram ismi bilan majburan qayta yozmaymiz.
            user.first_name = tg_user.first_name
            changed = True
        if changed:
            await db.commit()
            await db.refresh(user)

    token = create_access_token(user.id, user.telegram_id)
    return AuthResponse(
        access_token=token,
        is_new_user=is_new_user,
        user=UserOut.model_validate(user),
    )


async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Himoyalangan endpointlar uchun dependency. `/auth/telegram`da olingan
    JWT'ni tekshiradi va joriy userni DB'dan qaytaradi."""
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token noto'g'ri")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Foydalanuvchi topilmadi")
    return user


async def require_registered_user(user: User = Depends(get_current_user)) -> User:
    """Ro'yxatdan to'liq o'tmagan (rol tanlanmagan) userlarni asosiy
    funksiyalardan bloklaydi — ular avval bot orqali registratsiyani
    tugatishi kerak."""
    if not user.is_registered:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ro'yxatdan to'liq o'tilmagan. Avval Telegram bot orqali ro'yxatdan o'ting.",
        )
    return user


async def require_admin(user: User = Depends(require_registered_user)) -> User:
    if not (user.is_admin or user.is_super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Faqat admin uchun")
    return user
