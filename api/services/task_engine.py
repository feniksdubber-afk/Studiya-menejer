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
        and task.status not in (TaskStatus.accepted, TaskStatus.delayed)
    )


# Bu holatlardan avtomatik 'delayed'ga o'tish mumkin. 'accepted' — vazifa
# allaqachon yakunlangan, deadline'dan qat'iy nazar hech qachon kechikkan
# deb belgilanmaydi. 'delayed'ning o'zi ham istisno — idempotentlik uchun
# (bir marta belgilangan taskka qayta tegilmaymiz/qayta bildirishnoma
# yubormaymiz).
_OVERDUE_ELIGIBLE_STATUSES = (
    TaskStatus.pending,
    TaskStatus.submitted,
    TaskStatus.revision_requested,
)


async def mark_overdue_tasks_delayed(db: AsyncSession) -> list[Task]:
    """Deadline'i o'tib ketgan, hali yakunlanmagan va hali 'delayed' deb
    belgilanmagan barcha tasklarni topib, statusini 'delayed'ga o'zgartiradi
    va tegishli qism (Episode) statusini qayta hisoblaydi.

    Bot scheduleri tomonidan davriy chaqiriladi (§ /internal/tasks/mark-overdue).
    Bildirishnoma yuborish va Telegram push — chaqiruvchi (router/bot) tomonda,
    bu funksiya faqat holatni o'zgartiradi va o'zgargan tasklarni qaytaradi.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Task)
        .where(Task.deadline.is_not(None))
        .where(Task.deadline < now)
        .where(Task.status.in_(_OVERDUE_ELIGIBLE_STATUSES))
    )
    overdue_tasks = list(result.scalars().all())
    if not overdue_tasks:
        return []

    episode_ids: set[uuid.UUID] = set()
    for task in overdue_tasks:
        task.status = TaskStatus.delayed
        episode_ids.add(task.episode_id)

    await db.commit()
    for task in overdue_tasks:
        await db.refresh(task)

    for episode_id in episode_ids:
        await recompute_episode_status(db, episode_id)

    return overdue_tasks
