from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.users import User
from routers.auth import require_registered_user
from schemas.auth import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserOut])
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Ism yoki Telegram username bo'yicha ro'yxatdan o'tgan foydalanuvchilarni
    qidiradi. Loyihaga jamoa a'zosi qo'shishda foydalanuvchini tanlash uchun."""
    query = q.strip()
    if len(query) < 2:
        return []

    like = f"%{query}%"
    result = await db.execute(
        select(User)
        .where(User.is_registered.is_(True))
        .where(or_(User.first_name.ilike(like), User.telegram_username.ilike(like)))
        .limit(20)
    )
    return result.scalars().all()
