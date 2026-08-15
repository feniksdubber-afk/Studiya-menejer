"""Rejissyorlik so'rovlarini admin tomonidan tasdiqlash/rad etish.

Race condition himoyasi: ikki admin bir vaqtda bossa ham faqat bittasi
o'tishi kerak. Buning uchun SELECT+UPDATE emas, bitta ATOMIK
`UPDATE ... WHERE director_status='pending' RETURNING id` ishlatiladi —
PostgreSQL bu qatorni avtomatik lock qiladi, ikkinchi parallel UPDATE
0 qator qaytaradi va shu orqali "allaqachon hal qilingan" holatini
xatosiz aniqlaymiz (SELECT bilan tekshirib keyin UPDATE qilish orasida
race oyna qoladi — shuning uchun buni ishlatmaymiz).
"""
import logging
import uuid
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.types import CallbackQuery
from sqlalchemy import select, update

from db import get_session
from models.activity import ActivityLog
from models.users import DirectorStatus, User

router = Router(name="admin_approval")
logger = logging.getLogger(__name__)


async def _get_admin(telegram_id: int) -> User | None:
    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        admin = result.scalar_one_or_none()
        if admin and (admin.is_admin or admin.is_super_admin):
            return admin
        return None


async def _resolve_director_request(
    applicant_id: uuid.UUID, new_status: DirectorStatus
) -> User | None:
    """Atomik holatda pending -> approved/rejected. Muvaffaqiyatsiz bo'lsa
    (allaqachon hal qilingan) None qaytaradi."""
    async with get_session() as db:
        stmt = (
            update(User)
            .where(User.id == applicant_id, User.director_status == DirectorStatus.pending)
            .values(
                director_status=new_status,
                director_approved=(new_status == DirectorStatus.approved),
            )
            .returning(User.id)
        )
        result = await db.execute(stmt)
        updated_id = result.scalar_one_or_none()
        if updated_id is None:
            await db.rollback()
            return None

        await db.commit()

        result = await db.execute(select(User).where(User.id == applicant_id))
        return result.scalar_one()


async def _write_audit_log(admin_id: uuid.UUID, target_user_id: uuid.UUID, action: str) -> None:
    async with get_session() as db:
        db.add(
            ActivityLog(
                id=uuid.uuid4(),
                user_id=admin_id,
                action=action,  # "approved" / "rejected"
                entity_type="director_request",
                entity_id=target_user_id,
                meta={},
                created_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


@router.callback_query(F.data.startswith("dir_approve:"))
async def approve_director(callback: CallbackQuery, bot: Bot):
    admin = await _get_admin(callback.from_user.id)
    if admin is None:
        await callback.answer("Sizda ruxsat yo'q", show_alert=True)
        return

    applicant_id = uuid.UUID(callback.data.split(":", 1)[1])
    applicant = await _resolve_director_request(applicant_id, DirectorStatus.approved)

    if applicant is None:
        await callback.answer("⚠️ Bu so'rov allaqachon ko'rib chiqilgan.", show_alert=True)
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        return

    await _write_audit_log(admin.id, applicant.id, "approved")

    await callback.message.edit_text(callback.message.text + f"\n\n✅ Tasdiqlandi ({admin.first_name})")
    try:
        await bot.send_message(applicant.telegram_id, "🎬 Rejissyorlik so'rovingiz tasdiqlandi!")
    except Exception:
        logger.exception("Foydalanuvchiga xabar yuborilmadi: telegram_id=%s", applicant.telegram_id)
    await callback.answer("Tasdiqlandi")


@router.callback_query(F.data.startswith("dir_reject:"))
async def reject_director(callback: CallbackQuery, bot: Bot):
    admin = await _get_admin(callback.from_user.id)
    if admin is None:
        await callback.answer("Sizda ruxsat yo'q", show_alert=True)
        return

    applicant_id = uuid.UUID(callback.data.split(":", 1)[1])
    applicant = await _resolve_director_request(applicant_id, DirectorStatus.rejected)

    if applicant is None:
        await callback.answer("⚠️ Bu so'rov allaqachon ko'rib chiqilgan.", show_alert=True)
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        return

    await _write_audit_log(admin.id, applicant.id, "rejected")

    await callback.message.edit_text(callback.message.text + f"\n\n❌ Rad etildi ({admin.first_name})")
    try:
        # Spec §4: sabab yozish shart emas, faqat "❌ Rad etildi"
        await bot.send_message(applicant.telegram_id, "❌ Rad etildi")
    except Exception:
        logger.exception("Foydalanuvchiga xabar yuborilmadi: telegram_id=%s", applicant.telegram_id)
    await callback.answer("Rad etildi")
