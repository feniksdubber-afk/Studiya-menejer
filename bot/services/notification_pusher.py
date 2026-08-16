"""`notifications` jadvalidagi hali Telegram orqali yuborilmagan
yozuvlarni (`pushed_at IS NULL`) topib, ijrochilarga/rejissyorlarga push
xabar sifatida yetkazadi.

Bu bot va API bir xil bazaga ulanganidan (bot/db.py) foydalanib, xuddi
deadline_notifier.py kabi to'g'ridan-to'g'ri DB orqali ishlaydi -- alohida
internal endpoint shart emas, chunki bu yerda hech qanday biznes logika
yo'q, faqat "o'qi -> yubor -> belgila".

API tomonda `notify()` (api/services/notification_dispatcher.py) har bir
holat uchun (task tayinlash, qayta ishlashga qaytarish, fayl topshirish,
kechikish va h.k.) shu jadvalga yozadi. Ilgari bu yerda hech kim
o'qimagani uchun push xabarlar umuman yetib bormasdi -- shu fayl aynan
o'sha bo'shliqni yopadi.
"""
import logging
from datetime import datetime, timezone

from aiogram import Bot
from sqlalchemy import select

from db import get_session
from models.activity import Notification
from models.characters import Character
from models.projects import Episode, Project, Season
from models.tasks import Task, TaskType
from models.users import User

logger = logging.getLogger(__name__)

# Bir pollingda ko'pi bilan shuncha yozuv qayta ishlanadi -- katta orqada
# qolgan navbat butun scheduler tsiklini bloklab qo'ymasligi uchun.
BATCH_LIMIT = 200

_TASK_TYPE_LABELS = {
    TaskType.translation: "📝 Tarjima",
    TaskType.voice: "🎙️ Ovoz",
    TaskType.sound_video: "🎧 Yakuniy video",
    TaskType.sound_audio: "🎧 Yakuniy audio",
}


async def push_pending_notifications(bot: Bot) -> None:
    async with get_session() as db:
        result = await db.execute(
            select(Notification)
            .where(Notification.pushed_at.is_(None))
            .order_by(Notification.created_at)
            .limit(BATCH_LIMIT)
        )
        pending = result.scalars().all()

        if not pending:
            return

        logger.info("%d ta bildirishnoma push uchun navbatda", len(pending))

        for notification in pending:
            try:
                await _push_one(db, bot, notification)
            except Exception:
                logger.exception(
                    "Bildirishnomani push qilishda xato (notification_id=%s, type=%s)",
                    notification.id,
                    notification.type,
                )
            finally:
                # Yuborish muvaffaqiyatsiz bo'lsa ham belgilaymiz -- aks
                # holda doimiy xato beruvchi (masalan, o'chirilgan task'ga
                # ishora qiluvchi) bitta yozuv har pollingda takrorlanib,
                # navbatning qolgan qismini orqaga surib yuboradi. Real
                # Telegram xatolari (foydalanuvchi bot'ni bloklagan va h.k.)
                # kamdan-kam va qayta urinish qiymatga arzimaydi.
                notification.pushed_at = datetime.now(timezone.utc)
                await db.commit()


async def _push_one(db, bot: Bot, notification: Notification) -> None:
    user = await db.get(User, notification.user_id)
    if user is None:
        return

    text = await _build_text(db, notification)
    if text is None:
        return

    await bot.send_message(user.telegram_id, text)


async def _build_text(db, notification: Notification) -> str | None:
    payload = notification.payload or {}
    builder = _BUILDERS.get(notification.type)
    if builder is None:
        return None
    return await builder(db, payload)


async def _task_context(db, task_id: str | None):
    if not task_id:
        return None
    task = await db.get(Task, task_id)
    if task is None:
        return None
    episode = await db.get(Episode, task.episode_id)
    if episode is None:
        return None
    season = await db.get(Season, episode.season_id)
    project = await db.get(Project, season.project_id) if season else None
    character = await db.get(Character, task.character_id) if task.character_id else None
    return task, episode, project, character


async def _build_task_assigned(db, payload: dict) -> str | None:
    ctx = await _task_context(db, payload.get("task_id"))
    if ctx is None:
        return None
    task, episode, project, character = ctx

    lines = [
        "📌 Sizga yangi vazifa biriktirildi",
        "",
        f"🎬 {project.title if project else '?'} — {episode.title}",
    ]
    if character is not None:
        lines.append(f"🎭 {character.name}")
    lines.append(_TASK_TYPE_LABELS.get(task.task_type, str(task.task_type.value)))
    if task.deadline:
        lines.append(f"🕐 Deadline: {task.deadline.strftime('%d-%m %H:%M')}")
    return "\n".join(lines)


async def _build_task_submitted(db, payload: dict) -> str | None:
    ctx = await _task_context(db, payload.get("task_id"))
    if ctx is None:
        return None
    task, episode, project, character = ctx

    lines = [
        "📥 Fayl topshirildi — ko'rib chiqish kerak",
        "",
        f"🎬 {project.title if project else '?'} — {episode.title}",
    ]
    if character is not None:
        lines.append(f"🎭 {character.name}")
    lines.append(_TASK_TYPE_LABELS.get(task.task_type, str(task.task_type.value)))
    version_number = payload.get("version_number")
    if version_number:
        lines.append(f"📄 Versiya: v{version_number}")
    return "\n".join(lines)


async def _build_task_revision_requested(db, payload: dict) -> str | None:
    ctx = await _task_context(db, payload.get("task_id"))
    if ctx is None:
        return None
    task, episode, project, character = ctx

    lines = [
        "🔁 Vazifa qayta ishlashga qaytarildi",
        "",
        f"🎬 {project.title if project else '?'} — {episode.title}",
    ]
    if character is not None:
        lines.append(f"🎭 {character.name}")
    lines.append(_TASK_TYPE_LABELS.get(task.task_type, str(task.task_type.value)))
    reason = payload.get("reason")
    if reason:
        lines.append(f"💬 Sabab: {reason}")
    if task.deadline:
        lines.append(f"🕐 Yangi deadline: {task.deadline.strftime('%d-%m %H:%M')}")
    return "\n".join(lines)


async def _build_task_delayed(db, payload: dict) -> str | None:
    """Faqat rejissyorlar uchun ishlaydi -- ijrochiga darhol push xabar
    bot/services/deadline_notifier.py:check_overdue_tasks orqali alohida
    yuboriladi (shuning uchun uning yozuvi bu yerga yetib kelmaydi,
    already_delivered=True bilan yaratilgan)."""
    ctx = await _task_context(db, payload.get("task_id"))
    if ctx is None:
        return None
    task, episode, project, character = ctx

    assignee = await db.get(User, task.assigned_to)
    if assignee is not None:
        assignee_name = f"{assignee.first_name} {assignee.last_name or ''}".strip()
    else:
        assignee_name = "Jamoa a'zosi"

    lines = [
        "⚠️ Vazifa deadline'i o'tib ketdi",
        "",
        f"🎬 {project.title if project else '?'} — {episode.title}",
        f"👤 {assignee_name}",
    ]
    if character is not None:
        lines.append(f"🎭 {character.name}")
    lines.append(_TASK_TYPE_LABELS.get(task.task_type, str(task.task_type.value)))
    return "\n".join(lines)


async def _build_director_role_requested(db, payload: dict) -> str | None:
    name = payload.get("applicant_name") or "Foydalanuvchi"
    username = payload.get("applicant_username")
    username_line = f"@{username}" if username else "(username yo'q)"
    return (
        "🎬 Yangi rejissyorlik so'rovi\n\n"
        f"👤 {name}\n"
        f"🔗 {username_line}\n\n"
        "Ko'rib chiqish uchun /admin_pending buyrug'ini yuboring."
    )


_BUILDERS = {
    "task_assigned": _build_task_assigned,
    "task_submitted": _build_task_submitted,
    "task_revision_requested": _build_task_revision_requested,
    "task_delayed": _build_task_delayed,
    "director_role_requested": _build_director_role_requested,
}
