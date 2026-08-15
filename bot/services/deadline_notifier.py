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
from datetime import datetime, timedelta, timezone

from aiogram import Bot
from sqlalchemy import select

from db import get_session
from models.activity import Notification
from models.characters import Character
from models.projects import Episode, Project, Season
from models.tasks import Task, TaskStatus, TaskType
from models.users import User

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
    deadline_str = task.deadline.strftime("%d-%m %H:%M") if task.deadline else "-"

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
    )
    db.add(notification)

    task.notified_3h = True

    await db.commit()
