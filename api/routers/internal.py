from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import require_internal_service
from db.session import get_db
from models.projects import Episode, ProjectMember, ProjectRole, Season
from schemas.files import FileOut, FileSubmitResult, FileVersionOut, InternalFileSubmit
from schemas.tasks import OverdueMarkResult
from services.file_service import submit_file
from services.notification_dispatcher import notify
from services.task_engine import mark_overdue_tasks_delayed

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post(
    "/files",
    response_model=FileSubmitResult,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal_service)],
)
async def internal_submit_file(
    payload: InternalFileSubmit,
    db: AsyncSession = Depends(get_db),
):
    """Faqat bot server chaqiradi (§4.1) — `X-Internal-Api-Key` header talab
    qilinadi, oddiy foydalanuvchi JWT'i bu yerda ishlamaydi. Binary fayl
    hech qachon bu yerga kelmaydi, faqat Telegram file_id + metadata.

    Versiyalash: shu task uchun `files` yozuvi topiladi/yaratiladi, eski
    aktiv versiya `superseded` qilinadi, yangisi `active` sifatida qo'shiladi
    (v1 -> v2 -> v3 ...). Eski versiyalar hech qachon o'chirilmaydi.
    """
    file, version = await submit_file(db, payload)
    return FileSubmitResult(
        file=FileOut.model_validate(file),
        version=FileVersionOut.model_validate(version),
        task_status="submitted",
        task_current_version=version.version_number,
    )


@router.post(
    "/tasks/mark-overdue",
    response_model=OverdueMarkResult,
    dependencies=[Depends(require_internal_service)],
)
async def internal_mark_overdue_tasks(db: AsyncSession = Depends(get_db)):
    """Faqat bot scheduleri chaqiradi (bot/services/deadline_notifier.py),
    xuddi /internal/files kabi `X-Internal-Api-Key` bilan himoyalangan.

    Deadline'i o'tib ketgan, hali yakunlanmagan tasklarni 'delayed'ga
    o'tkazadi (services/task_engine.mark_overdue_tasks_delayed — biznes
    logikaning yagona manbai) va tayinlangan ijrochi + loyiha
    rejissyorlariga in-app bildirishnoma yaratadi. Telegram push xabarini
    bot o'zi javobdagi task_id'lar asosida alohida yuboradi (chat_id kabi
    Telegram-specific narsalar API'da emas, bot tomonda saqlanadi).
    """
    changed_tasks = await mark_overdue_tasks_delayed(db)

    for task in changed_tasks:
        # Ijrochiga Telegram push xabari shu javobdagi task_id'lar asosida
        # bot tomonidan darhol (bot/services/deadline_notifier.py:
        # check_overdue_tasks -> _push_overdue_message) yuboriladi, shuning
        # uchun bu yozuv `already_delivered=True` bilan darhol "pushed"
        # deb belgilanadi -- aks holda umumiy push navbatchisi
        # (notification_pusher.py) xuddi shu xabarni yana bir marta
        # yuborib yuborardi.
        await notify(
            db,
            user_id=task.assigned_to,
            type_="task_delayed",
            payload={"task_id": str(task.id), "episode_id": str(task.episode_id)},
            already_delivered=True,
        )

        episode = await db.get(Episode, task.episode_id)
        season = await db.get(Season, episode.season_id) if episode else None
        if season is not None:
            directors = await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == season.project_id,
                    ProjectMember.role_in_project.in_(
                        [ProjectRole.director_main, ProjectRole.director_extra]
                    ),
                )
            )
            for director in directors.scalars().all():
                await notify(
                    db,
                    user_id=director.user_id,
                    type_="task_delayed",
                    payload={"task_id": str(task.id), "episode_id": str(task.episode_id)},
                )

    return OverdueMarkResult(
        marked_count=len(changed_tasks),
        task_ids=[t.id for t in changed_tasks],
    )
