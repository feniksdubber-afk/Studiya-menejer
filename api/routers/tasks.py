import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.characters import Character
from models.projects import Episode
from models.tasks import DeadlineHistory, Task, TaskStatus, TaskType
from models.users import User
from routers.auth import require_registered_user
from schemas.tasks import (
    DeadlineHistoryOut,
    TaskCreate,
    TaskOut,
    TaskRevisionRequest,
    TaskStatusUpdate,
    TaskUpdate,
)
from services.notification_dispatcher import notify
from services.permissions import (
    get_membership,
    get_project_or_404,
    is_project_director,
    require_project_director,
)
from services.task_engine import recompute_episode_status

router = APIRouter(tags=["tasks"])


def _task_out(task: Task, can_manage: bool, character_name: str | None = None) -> TaskOut:
    out = TaskOut.model_validate(task)
    out.can_manage = can_manage
    out.character_name = character_name
    return out


async def _get_character_name(db: AsyncSession, character_id: uuid.UUID | None) -> str | None:
    """Bitta vazifa uchun personaj nomi (yagona-task endpointlar uchun)."""
    if character_id is None:
        return None
    character = await db.get(Character, character_id)
    return character.name if character is not None else None


async def _character_names(db: AsyncSession, tasks: list[Task]) -> dict[uuid.UUID, str]:
    """Bir nechta task uchun character_id -> name xaritasini bitta so'rov
    bilan oladi (N+1 so'rovlarning oldini olish uchun — ro'yxat endpointlari)."""
    character_ids = {t.character_id for t in tasks if t.character_id is not None}
    if not character_ids:
        return {}
    result = await db.execute(select(Character).where(Character.id.in_(character_ids)))
    return {c.id: c.name for c in result.scalars().all()}


async def _get_episode_and_project(db: AsyncSession, episode_id: uuid.UUID):
    episode = await db.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Qism topilmadi")
    from models.projects import Season  # local import: avoid circular concerns

    season = await db.get(Season, episode.season_id)
    project = await get_project_or_404(season.project_id, db)
    return episode, project


async def _get_task_or_404(db: AsyncSession, task_id: uuid.UUID) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vazifa topilmadi")
    return task


async def _check_task_view_access(db: AsyncSession, task: Task, user: User) -> None:
    if user.is_admin or user.is_super_admin or task.assigned_to == user.id:
        return
    _, project = await _get_episode_and_project(db, task.episode_id)
    membership = await get_membership(db, project.id, user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu vazifani ko'rish huquqingiz yo'q")


# ==================== TASKS ====================

@router.get("/episodes/{episode_id}/tasks", response_model=list[TaskOut])
async def list_episode_tasks(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode, project = await _get_episode_and_project(db, episode_id)
    if not (user.is_admin or user.is_super_admin):
        membership = await get_membership(db, project.id, user.id)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Siz bu loyiha a'zosi emassiz")

    result = await db.execute(select(Task).where(Task.episode_id == episode_id))
    tasks = list(result.scalars().all())
    can_manage = await is_project_director(db, project.id, user)
    names = await _character_names(db, tasks)
    return [_task_out(t, can_manage, names.get(t.character_id)) for t in tasks]


@router.get("/tasks/mine", response_model=list[TaskOut])
async def list_my_tasks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Vazifalarim (§: revision → delayed → deadline yaqin → qolgan)."""
    result = await db.execute(select(Task).where(Task.assigned_to == user.id))
    tasks = list(result.scalars().all())

    priority = {
        TaskStatus.revision_requested: 0,
        TaskStatus.delayed: 1,
    }

    def sort_key(t: Task):
        base = priority.get(t.status, 2)
        deadline = t.deadline or datetime.max.replace(tzinfo=timezone.utc)
        return (base, deadline)

    tasks.sort(key=sort_key)

    # Har bir task boshqa loyihaga tegishli bo'lishi mumkin — loyiha
    # bo'yicha natijani keshlab, takroriy so'rovlarning oldini olamiz.
    project_can_manage_cache: dict[uuid.UUID, bool] = {}
    names = await _character_names(db, tasks)
    out: list[TaskOut] = []
    for t in tasks:
        _, project = await _get_episode_and_project(db, t.episode_id)
        if project.id not in project_can_manage_cache:
            project_can_manage_cache[project.id] = await is_project_director(db, project.id, user)
        out.append(_task_out(t, project_can_manage_cache[project.id], names.get(t.character_id)))
    return out


@router.post(
    "/episodes/{episode_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    episode_id: uuid.UUID,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode, project = await _get_episode_and_project(db, episode_id)
    await require_project_director(project, user, db)

    if payload.task_type == TaskType.voice and payload.character_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ovoz (voice) vazifasi uchun character_id majburiy",
        )

    assignee = await db.get(User, payload.assigned_to)
    if assignee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tayinlanuvchi foydalanuvchi topilmadi")

    task = Task(
        id=uuid.uuid4(),
        episode_id=episode_id,
        task_type=payload.task_type,
        character_id=payload.character_id,
        assigned_to=payload.assigned_to,
        assigned_by=user.id,
        deadline=payload.deadline,
        status=TaskStatus.pending,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await recompute_episode_status(db, episode_id)
    await notify(
        db,
        user_id=task.assigned_to,
        type_="task_assigned",
        payload={"task_id": str(task.id), "episode_id": str(episode_id), "task_type": task.task_type.value},
    )
    character_name = await _get_character_name(db, task.character_id)
    return _task_out(task, can_manage=True, character_name=character_name)


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    task = await _get_task_or_404(db, task_id)
    await _check_task_view_access(db, task, user)
    _, project = await _get_episode_and_project(db, task.episode_id)
    can_manage = await is_project_director(db, project.id, user)
    character_name = await _get_character_name(db, task.character_id)
    return _task_out(task, can_manage, character_name)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Tayinlanuvchi/personaj/deadline'ni to'g'ridan-to'g'ri o'zgartirish
    (deadline uchun tarixiy sabab kerak bo'lsa /request-revision ishlating)."""
    task = await _get_task_or_404(db, task_id)
    _, project = await _get_episode_and_project(db, task.episode_id)
    await require_project_director(project, user, db)

    if payload.assigned_to is not None:
        new_assignee = await db.get(User, payload.assigned_to)
        if new_assignee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tayinlanuvchi foydalanuvchi topilmadi")

    data = payload.model_dump(exclude_unset=True)
    old_assignee = task.assigned_to
    deadline_changed = "deadline" in data and data["deadline"] != task.deadline
    for field, value in data.items():
        setattr(task, field, value)
    if payload.assigned_to is not None and payload.assigned_to != old_assignee:
        task.assigned_by = user.id
    if deadline_changed:
        # Deadline to'g'ridan-to'g'ri (request-revision'siz) o'zgartirilganda
        # ham 3-soatlik eslatma bayrog'ini tiklash kerak — aks holda, agar
        # eski deadline uchun eslatma allaqachon yuborilgan bo'lsa, yangi
        # deadline uchun eslatma hech qachon yubormaydi (notified_3h True
        # bo'lib qolaveradi).
        task.notified_3h = False
    await db.commit()
    await db.refresh(task)

    if payload.assigned_to is not None and payload.assigned_to != old_assignee:
        await notify(
            db,
            user_id=task.assigned_to,
            type_="task_assigned",
            payload={"task_id": str(task.id), "episode_id": str(task.episode_id)},
        )
    character_name = await _get_character_name(db, task.character_id)
    return _task_out(task, can_manage=True, character_name=character_name)


@router.post("/tasks/{task_id}/status", response_model=TaskOut)
async def set_task_status(
    task_id: uuid.UUID,
    payload: TaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Status o'zgartirish. `submitted` odatda fayl topshirish oqimi (bot)
    orqali avtomatik o'rnatiladi; `accepted`/`revision_requested` esa
    rejissyor tomonidan. Bu yerda ikkalasiga ham ruxsat beramiz, huquqni
    holatga qarab tekshiramiz."""
    task = await _get_task_or_404(db, task_id)
    _, project = await _get_episode_and_project(db, task.episode_id)

    is_privileged = user.is_admin or user.is_super_admin
    if not is_privileged:
        membership = await get_membership(db, project.id, user.id)
        is_privileged = membership is not None and membership.role_in_project.value.startswith("director")

    if payload.status in (TaskStatus.accepted, TaskStatus.revision_requested, TaskStatus.delayed):
        if not is_privileged:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu holatni faqat rejissyor belgilay oladi")
    elif payload.status == TaskStatus.submitted:
        if not (is_privileged or task.assigned_to == user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Faqat tayinlangan ijrochi topshira oladi")

    task.status = payload.status
    await db.commit()
    await db.refresh(task)
    await recompute_episode_status(db, task.episode_id)

    if payload.status == TaskStatus.submitted:
        _, project = await _get_episode_and_project(db, task.episode_id)
        # Rejissyorlarga xabar
        from models.projects import ProjectMember, ProjectRole

        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.role_in_project.in_([ProjectRole.director_main, ProjectRole.director_extra]),
            )
        )
        for director in result.scalars().all():
            await notify(
                db,
                user_id=director.user_id,
                type_="task_submitted",
                payload={"task_id": str(task.id)},
            )

    character_name = await _get_character_name(db, task.character_id)
    return _task_out(task, is_privileged, character_name)


@router.post("/tasks/{task_id}/request-revision", response_model=TaskOut)
async def request_revision(
    task_id: uuid.UUID,
    payload: TaskRevisionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    task = await _get_task_or_404(db, task_id)
    _, project = await _get_episode_and_project(db, task.episode_id)
    await require_project_director(project, user, db)

    old_deadline = task.deadline
    if payload.new_deadline is not None:
        db.add(
            DeadlineHistory(
                id=uuid.uuid4(),
                task_id=task.id,
                old_deadline=old_deadline,
                new_deadline=payload.new_deadline,
                reason=payload.reason,
                changed_at=datetime.now(timezone.utc),
            )
        )
        task.deadline = payload.new_deadline
        task.notified_3h = False  # yangi deadline uchun 3-soatlik eslatma qayta faollashadi

    task.status = TaskStatus.revision_requested
    task.revision_reason = payload.reason
    await db.commit()
    await db.refresh(task)
    await recompute_episode_status(db, task.episode_id)

    await notify(
        db,
        user_id=task.assigned_to,
        type_="task_revision_requested",
        payload={"task_id": str(task.id), "reason": payload.reason},
    )
    character_name = await _get_character_name(db, task.character_id)
    return _task_out(task, can_manage=True, character_name=character_name)


@router.get("/tasks/{task_id}/deadline-history", response_model=list[DeadlineHistoryOut])
async def get_deadline_history(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    task = await _get_task_or_404(db, task_id)
    await _check_task_view_access(db, task, user)
    result = await db.execute(
        select(DeadlineHistory).where(DeadlineHistory.task_id == task_id).order_by(DeadlineHistory.changed_at.desc())
    )
    return result.scalars().all()
