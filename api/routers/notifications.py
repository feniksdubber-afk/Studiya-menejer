import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.activity import Notification
from models.users import User
from routers.auth import require_registered_user
from schemas.notifications import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Mini App bildirishnomalar markazi (avval mavjud bo'lmagan funksional
# bo'shliq): `is_read` — foydalanuvchi buni shu yerda ko'rdimi degan
# ma'noni bildiradi, `pushed_at`dan (Telegram orqali yuborilganmi) butunlay
# alohida — qarang: api/models/activity.py.


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    limit = max(1, min(limit, 100))
    query = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    return UnreadCountOut(unread_count=result.scalar_one())


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bildirishnoma topilmadi")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
