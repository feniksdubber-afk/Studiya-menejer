"""Deadline'ga 3 soat qolgan tasklar uchun avtomatik Telegram eslatma (spec §9).

Scheduler (bot/main.py) har DEADLINE_CHECK_INTERVAL_MINUTES daqiqada
`check_deadlines()`ni chaqiradi: deadline'i 3 soatdan kam qolgan, hali
`notified_3h=False` va hali yakunlanmagan (accepted emas) barcha tasklarni
topib, tegishli foydalanuvchiga Telegram xabar yuboradi hamda in-app
Notification yozuvini yaratadi.

Eslatma faqat bitta marta yuboriladi — `notified_3h` True qilingach, task
qayta topshirilib yangi deadline belgilanmaguncha (bu holda deadline_history
yozuvini yaratadigan router shu flagni False'ga qaytarishi kerak) qayta
yuborilmaydi.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from aiogram import Bot
from sqlalchemy import select

from db import get_session
from models.activity import Notification
from models.characters import Character
from models.projects import Episode, Project, Season
from models.tasks import Task, TaskStatus, TaskType
from models.users import User
from services.api_client import InternalApiError, mark_overdue_tasks
from utils.timefmt import format_dt

logger = logging.getLogger(__name__)

_TASK_TYPE_LABELS = {
    TaskType.translation: "📝 Tarjima topshirish",
    TaskType.voice: "🎙️ Ovoz topshirish",
    TaskType.sound_video: "🎧 Yakuniy video topshirish",
    TaskType.sound_audio: "🎧 Yakuniy audio topshirish",
}


async def check_deadlines(bot: Bot) -> None:
    now = datetime.now(timezone.utc)
    soon_threshold = now + timedelta(hours=3)

    async with get_session() as db:
        result = await db.execute(
            select(Task)
            .where(Task.deadline.is_not(None))
            .where(Task.deadline <= soon_threshold)
            .where(Task.deadline > now)
            .where(Task.notified_3h.is_(False))
            .where(Task.status != TaskStatus.accepted)
        )
        tasks = result.scalars().all()

        if not tasks:
            return

        logger.info("Deadline eslatmasi: %d ta task topildi", len(tasks))

        for task in tasks:
            try:
                await _notify_one(db, bot, task)
            except Exception:
                logger.exception(
                    "Deadline eslatmasini yuborishda xato (task_id=%s)", task.id
                )


async def _notify_one(db, bot: Bot, task: Task) -> None:
    episode = await db.get(Episode, task.episode_id)
    if episode is None:
        return
    season = await db.get(Season, episode.season_id)
    project = await db.get(Project, season.project_id) if season else None
    user = await db.get(User, task.assigned_to)
    if user is None:
        return

    character = await db.get(Character, task.character_id) if task.character_id else None

    project_title = project.title if project else "?"
    task_label = _TASK_TYPE_LABELS.get(task.task_type, str(task.task_type.value))
    deadline_str = format_dt(task.deadline)

    lines = [
        "⏰ Deadline'ga 3 soat qoldi",
        "",
        f"🎬 {project_title} — {episode.title}",
    ]
    if character is not None:
        lines.append(f"🎭 {character.name}")
    lines.append(task_label)
    lines.append(f"🕐 Deadline: {deadline_str}")
    text = "\n".join(lines)

    await bot.send_message(user.telegram_id, text)

    notification = Notification(
        user_id=user.id,
        type="deadline_soon",
        payload={
            "task_id": str(task.id),
            "episode_id": str(episode.id),
            "project_id": str(project.id) if project else None,
        },
        # Telegram xabari yuqorida shu funksiya ichida darhol yuborildi,
        # shuning uchun umumiy push navbatchisi (notification_pusher.py)
        # buni qayta yubormasligi uchun darhol "pushed" deb belgilanadi.
        pushed_at=datetime.now(timezone.utc),
    )
    db.add(notification)

    task.notified_3h = True

    await db.commit()


async def check_overdue_tasks(bot: Bot) -> None:
    """Deadline'i o'tib ketgan tasklarni 'delayed'ga o'tkazish uchun API'ning
    `/internal/tasks/mark-overdue` endpointini chaqiradi (biznes logika —
    services/task_engine.py, holat o'zgartirish va in-app Notification
    yaratish API tomonda bo'ladi). Bu funksiya faqat qaytgan task_id'lar
    bo'yicha ijrochilarga Telegram push xabar yuboradi.
    """
    try:
        result = await mark_overdue_tasks()
    except InternalApiError:
        logger.exception("Kechikkan tasklarni belgilashda API xatosi")
        return
    except Exception:
        logger.exception("Kechikkan tasklarni belgilashda kutilmagan xato")
        return

    task_ids = result.get("task_ids") or []
    if not task_ids:
        return

    logger.info("%d ta task 'kechikkan' deb belgilandi", len(task_ids))

    async with get_session() as db:
        for task_id_raw in task_ids:
            try:
                await _push_overdue_message(db, bot, uuid.UUID(task_id_raw))
            except Exception:
                logger.exception(
                    "Kechikkan xabarini yuborishda xato (task_id=%s)", task_id_raw
                )


async def _push_overdue_message(db, bot: Bot, task_id: uuid.UUID) -> None:
    task = await db.get(Task, task_id)
    if task is None:
        return
    episode = await db.get(Episode, task.episode_id)
    if episode is None:
        return
    season = await db.get(Season, episode.season_id)
    project = await db.get(Project, season.project_id) if season else None
    user = await db.get(User, task.assigned_to)
    if user is None:
        return

    task_label = _TASK_TYPE_LABELS.get(task.task_type, str(task.task_type.value))
    project_title = project.title if project else "?"
    deadline_str = format_dt(task.deadline)

    text = (
        "⚠️ Deadline o'tib ketdi\n\n"
        f"🎬 {project_title} — {episode.title}\n"
        f"{task_label}\n"
        f"🕐 Deadline: {deadline_str}\n\n"
        "Iltimos, imkon qadar tezroq topshiring yoki rejissyor bilan bog'laning."
    )
    try:
        await bot.send_message(user.telegram_id, text)
    except Exception:
        logger.exception("Foydalanuvchiga kechikish xabari yuborilmadi: telegram_id=%s", user.telegram_id)
