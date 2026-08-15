import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from models.activity import Notification


async def notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    type_: str,
    payload: dict,
    already_delivered: bool = False,
) -> Notification:
    """In-app notification yozuvini yaratadi va commit qiladi.

    Telegram push xabar bot/services/notification_pusher.py orqali alohida
    scheduler job sifatida yuboriladi -- bu funksiya faqat DB yozuvini
    yaratadi, `pushed_at` NULL bo'lib qoladi va bot navbatdagi pollingda
    (~1 daqiqa ichida) uni topib Telegram orqali jo'natadi.

    `already_delivered=True` faqat foydalanuvchi xabarni allaqachon boshqa
    yo'l bilan (masalan, chaqiruvchi kod shu request ichida bevosita
    `bot.send_message` chaqirgan bo'lsa) olgan bo'lsa ishlatiladi -- bunda
    push navbatchisi uni qayta yubormasligi uchun `pushed_at` darhol
    to'ldiriladi.
    """
    notification = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        type=type_,
        payload=payload,
        pushed_at=datetime.now(timezone.utc) if already_delivered else None,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification
