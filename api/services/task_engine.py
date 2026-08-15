import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.projects import Episode, EpisodeStatus
from models.tasks import Task, TaskStatus


async def recompute_episode_status(db: AsyncSession, episode_id: uuid.UUID) -> EpisodeStatus:
    """Episode.status foydalanuvchi tomonidan qo'lda o'zgartirilmaydi — bu
    funksiya shu qismga tegishli barcha tasklar holatiga qarab avtomatik
    hisoblaydi va DB'ga yozadi. Task yaratilgan/holati o'zgargan har safar
    chaqirilishi kerak.

    Qoidalar (spec §52):
    - Task yo'q bo'lsa           -> not_started
    - Har qanday task 'delayed'  -> delayed (eng yuqori ustuvorlik)
    - Har qanday task
      'revision_requested'       -> revision
    - Barcha tasklar 'accepted'  -> ready
    - Aks holda (kamida bittasi boshlangan) -> in_progress
    """
    result = await db.execute(select(Task).where(Task.episode_id == episode_id))
    tasks = result.scalars().all()

    if not tasks:
        new_status = EpisodeStatus.not_started
    elif any(t.status == TaskStatus.delayed for t in tasks):
        new_status = EpisodeStatus.delayed
    elif any(t.status == TaskStatus.revision_requested for t in tasks):
        new_status = EpisodeStatus.revision
    elif all(t.status == TaskStatus.accepted for t in tasks):
        new_status = EpisodeStatus.ready
    elif all(t.status == TaskStatus.pending for t in tasks):
        new_status = EpisodeStatus.not_started
    else:
        new_status = EpisodeStatus.in_progress

    episode = await db.get(Episode, episode_id)
    if episode is not None and episode.status != new_status:
        episode.status = new_status
        await db.commit()

    return new_status


def is_task_overdue(task: Task) -> bool:
    return (
        task.deadline is not None
        and task.deadline < datetime.now(timezone.utc)
        and task.status not in (TaskStatus.accepted,)
    )
