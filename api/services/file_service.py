import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.files import File, FileKind, FileVersion, VersionStatus
from models.projects import Episode, Season
from models.tasks import Task, TaskStatus
from models.users import User
from schemas.files import InternalFileSubmit
from services.notification_dispatcher import notify
from services.task_engine import recompute_episode_status

# Task turi -> shu task natijasida yaratiladigan fayl turi
_TASK_TYPE_TO_FILE_KIND = {
    "translation": FileKind.translation,
    "voice": FileKind.voice,
    "sound_video": FileKind.sound_video,
    "sound_audio": FileKind.sound_audio,
}

# Bu holatlardan fayl topshirish mumkin. `accepted` bo'lsa avval
# qayta topshirish (revision) so'ralishi kerak — rejissyor tomonidan.
_SUBMITTABLE_STATUSES = {TaskStatus.pending, TaskStatus.revision_requested, TaskStatus.submitted, TaskStatus.delayed}


async def submit_file(db: AsyncSession, payload: InternalFileSubmit) -> tuple[File, FileVersion]:
    task = await db.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vazifa topilmadi")

    if payload.uploaded_by != task.assigned_to:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat tayinlangan ijrochi shu vazifaga fayl topshira oladi",
        )

    if task.status not in _SUBMITTABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{task.status.value}' holatidagi vazifaga fayl topshirib bo'lmaydi",
        )

    uploader = await db.get(User, payload.uploaded_by)
    if uploader is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foydalanuvchi topilmadi")

    episode = await db.get(Episode, task.episode_id)
    season = await db.get(Season, episode.season_id) if episode else None

    # Shu task uchun logik "files" yozuvi bormi? (bitta task = bitta File,
    # ustiga versiyalar qo'shiladi)
    result = await db.execute(select(File).where(File.task_id == task.id))
    file = result.scalars().first()

    file_kind = _TASK_TYPE_TO_FILE_KIND.get(task.task_type.value, FileKind.other)

    if file is None:
        file = File(
            id=uuid.uuid4(),
            telegram_file_id=payload.telegram_file_id,
            telegram_message_id=payload.telegram_message_id,
            original_name=payload.file_name,
            current_name=payload.file_name,
            mime_type=payload.mime_type,
            file_size=payload.file_size,
            owner_id=payload.uploaded_by,
            project_id=season.project_id if season else None,
            episode_id=task.episode_id,
            task_id=task.id,
            file_kind=file_kind,
        )
        db.add(file)
        await db.flush()
        next_version_number = 1
    else:
        # Yangi versiya kelganda "files" pointer'ini eng so'nggi versiyaga yangilaymiz.
        file.telegram_file_id = payload.telegram_file_id
        file.telegram_message_id = payload.telegram_message_id
        file.current_name = payload.file_name
        file.mime_type = payload.mime_type
        file.file_size = payload.file_size

        prev_result = await db.execute(
            select(FileVersion).where(FileVersion.file_id == file.id, FileVersion.is_active.is_(True))
        )
        prev_active = prev_result.scalars().first()
        if prev_active is not None:
            # Avval eski versiyani superseded qilamiz (keyin yangisini qo'shamiz) —
            # partial unique index (file_id) WHERE is_active bir vaqtning o'zida
            # ikkita aktiv versiyaga yo'l qo'ymaydi, shuning uchun tartib muhim.
            prev_active.is_active = False
            prev_active.status = VersionStatus.superseded
            await db.flush()

        count_result = await db.execute(select(FileVersion).where(FileVersion.file_id == file.id))
        next_version_number = len(count_result.scalars().all()) + 1

    version = FileVersion(
        id=uuid.uuid4(),
        file_id=file.id,
        version_number=next_version_number,
        telegram_file_id=payload.telegram_file_id,
        file_name=payload.file_name,
        uploaded_by=payload.uploaded_by,
        is_active=True,
        status=VersionStatus.active,
    )
    db.add(version)

    task.current_version = next_version_number
    task.status = TaskStatus.submitted
    task.revision_reason = None

    await db.commit()
    await db.refresh(file)
    await db.refresh(version)

    await recompute_episode_status(db, task.episode_id)

    if season is not None:
        from models.projects import ProjectMember, ProjectRole

        directors = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == season.project_id,
                ProjectMember.role_in_project.in_([ProjectRole.director_main, ProjectRole.director_extra]),
            )
        )
        for director in directors.scalars().all():
            await notify(
                db,
                user_id=director.user_id,
                type_="task_submitted",
                payload={
                    "task_id": str(task.id),
                    "version_number": next_version_number,
                    "file_name": payload.file_name,
                },
            )

    return file, version
