import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from models.activity import Notification


async def notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    type_: str,
    payload: dict,
) -> Notification:
    """In-app notification yozuvini yaratadi va commit qiladi.

    Bot orqali push yuborish (Telegram xabar) hozircha bog'lanmagan —
    §4dagi rejaga ko'ra bu yerga ichki HTTP chaqiruv (bot serverga) yoki
    Redis queue qo'shiladi. Hozircha faqat DB yozuvi: Mini App
    bildirishnomalar markazi buni ko'rsatishi uchun yetarli.
    TODO: bot_client.push(user_id, type_, payload) ni ulash.
    """
    notification = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        type=type_,
        payload=payload,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification
