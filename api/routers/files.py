import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import get_db
from models.files import File, FileKind, FileVersion
from models.projects import Episode, Project, Season
from models.tasks import Task, TaskType
from models.users import User
from routers.auth import require_registered_user
from schemas.files import (
    OriginalVideoConfirm,
    OriginalVideoOut,
    OriginalVideoPlaybackOut,
    OriginalVideoUploadUrlOut,
    OriginalVideoUploadUrlRequest,
    TaskFileOut,
)
from services.permissions import get_membership, get_project_or_404, is_project_director, require_project_member
from services import r2_storage
from services.telegram_files import FILE_URL_TTL_SECONDS, get_telegram_file_url

router = APIRouter(tags=["files"])

# Ish oqimidagi tabiiy ketma-ketlik: har bir bosqich o'zidan oldingi
# bosqich natijasini ko'rishi/eshitishi kerak (masalan ovoz aktyori
# tarjimonning matnini emas, balki rejissyor tayyorlagan original videoni
# ko'radi; svedeniyachi esa aktyorning ovoz yozuvini eshitib montaj qiladi).
# `translation` -> original video (Video Studio, alohida endpoint bor)
# `voice`       -> original video (xuddi shu, VoiceCue orqali ham ko'rinadi)
# `sound_audio` -> shu qismning `voice` turidagi topshirilgan fayli
# `sound_video` -> shu qismning `sound_audio` turidagi topshirilgan fayli
_UPSTREAM_TASK_TYPE: dict[TaskType, TaskType] = {
    TaskType.sound_audio: TaskType.voice,
    TaskType.sound_video: TaskType.sound_audio,
}


async def _get_episode_and_project(db: AsyncSession, episode_id: uuid.UUID) -> tuple[Episode, Project]:
    episode = await db.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Qism topilmadi")
    season = await db.get(Season, episode.season_id)
    project = await get_project_or_404(season.project_id, db)
    return episode, project


async def _get_original_video(db: AsyncSession, episode_id: uuid.UUID) -> File | None:
    result = await db.execute(
        select(File).where(File.episode_id == episode_id, File.file_kind == FileKind.original_video)
    )
    return result.scalars().first()


async def _require_can_replace_or_upload(
    db: AsyncSession, project: Project, user: User, existing: File | None
) -> None:
    """Video hali yo'q bo'lsa — istalgan loyiha a'zosi birinchi marta yuklay
    oladi. Video allaqachon mavjud bo'lsa — faqat rejissyor/admin almashtira
    oladi (oddiy a'zo, hatto o'zi birinchi yuklagan bo'lsa ham, qayta
    yuklay olmaydi). §V1."""
    if existing is None:
        return
    if not await is_project_director(db, project.id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Video allaqachon mavjud — faqat rejissyor yoki admin uni almashtira oladi",
        )


@router.post("/episodes/{episode_id}/original-video/upload-url", response_model=OriginalVideoUploadUrlOut)
async def create_original_video_upload_url(
    episode_id: uuid.UUID,
    payload: OriginalVideoUploadUrlRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    existing = await _get_original_video(db, episode_id)
    await _require_can_replace_or_upload(db, project, user, existing)

    key = r2_storage.build_video_object_key(payload.file_name)
    upload_url = r2_storage.generate_presigned_upload_url(
        key, payload.mime_type, settings.video_upload_url_expires_seconds
    )
    return OriginalVideoUploadUrlOut(
        upload_url=upload_url, r2_key=key, expires_in=settings.video_upload_url_expires_seconds
    )


@router.post("/episodes/{episode_id}/original-video/confirm", response_model=OriginalVideoOut)
async def confirm_original_video(
    episode_id: uuid.UUID,
    payload: OriginalVideoConfirm,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Brauzer R2'ga to'g'ridan-to'g'ri yuklab bo'lgach chaqiriladi. Haqiqiy
    fayl hajmi R2'dan qayta so'raladi (frontend tekshiruviga ishonib
    bo'lmaydi) va 500 MB chegarasi shu yerda ham tekshiriladi (§V1)."""
    episode, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    existing = await _get_original_video(db, episode_id)
    await _require_can_replace_or_upload(db, project, user, existing)

    if not payload.r2_key.startswith("dub-videos/"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Noto'g'ri r2_key")

    size = r2_storage.get_object_size(payload.r2_key)
    if size is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fayl R2'da topilmadi — yuklash tugallanmagan bo'lishi mumkin",
        )
    if size > settings.video_max_bytes:
        r2_storage.delete_object(payload.r2_key)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Video hajmi {settings.video_max_bytes // (1024 * 1024)} MB dan katta bo'lmasligi kerak",
        )

    old_key = existing.r2_key if existing is not None else None

    if existing is not None:
        existing.r2_key = payload.r2_key
        existing.original_name = payload.file_name
        existing.current_name = payload.file_name
        existing.mime_type = payload.mime_type
        existing.file_size = size
        existing.owner_id = user.id
        file = existing
    else:
        file = File(
            id=uuid.uuid4(),
            telegram_file_id=None,
            telegram_message_id=None,
            r2_key=payload.r2_key,
            original_name=payload.file_name,
            current_name=payload.file_name,
            mime_type=payload.mime_type,
            file_size=size,
            owner_id=user.id,
            project_id=project.id,
            episode_id=episode_id,
            file_kind=FileKind.original_video,
        )
        db.add(file)

    await db.commit()
    await db.refresh(file)

    if old_key and old_key != file.r2_key:
        r2_storage.delete_object(old_key)

    return OriginalVideoOut.model_validate(file)


@router.get("/episodes/{episode_id}/original-video", response_model=OriginalVideoPlaybackOut)
async def get_original_video_playback_url(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    _, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    file = await _get_original_video(db, episode_id)
    if file is None or not file.r2_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bu qism uchun video hali yuklanmagan")

    video_url = r2_storage.generate_presigned_download_url(
        file.r2_key, settings.video_playback_url_expires_seconds
    )
    return OriginalVideoPlaybackOut(video_url=video_url, expires_in=settings.video_playback_url_expires_seconds)


@router.delete("/episodes/{episode_id}/original-video", status_code=status.HTTP_204_NO_CONTENT)
async def delete_original_video(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """O'chirish huquqi: kim yuklagan bo'lsa o'sha + rejissyor + admin (§V1)."""
    _, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    file = await _get_original_video(db, episode_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bu qism uchun video hali yuklanmagan")

    if file.owner_id != user.id and not await is_project_director(db, project.id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat video yuklagan shaxs, rejissyor yoki admin o'chira oladi",
        )

    key = file.r2_key
    await db.delete(file)
    await db.commit()

    if key:
        r2_storage.delete_object(key)


# ==================== TASK/UPSTREAM FILE PLAYBACK ====================
# Tarjimon, ovoz aktyori va svedeniyachi uchun: joriy vazifaning o'zi
# topshirgan faylini yoki ish zanjiridagi oldingi bosqich natijasini Mini
# App ichida to'g'ridan-to'g'ri ko'rish/eshitish/yuklab olish.


async def _active_file_and_version(db: AsyncSession, task_id: uuid.UUID) -> tuple[File, FileVersion] | None:
    result = await db.execute(select(File).where(File.task_id == task_id))
    file = result.scalars().first()
    if file is None or not file.telegram_file_id:
        return None
    version_result = await db.execute(
        select(FileVersion).where(FileVersion.file_id == file.id, FileVersion.is_active.is_(True))
    )
    version = version_result.scalars().first()
    if version is None:
        return None
    return file, version


async def _build_task_file_out(file: File, version: FileVersion) -> TaskFileOut:
    file_url = await get_telegram_file_url(file.telegram_file_id)
    return TaskFileOut(
        file_id=file.id,
        task_id=file.task_id,
        file_kind=file.file_kind,
        current_name=file.current_name,
        mime_type=file.mime_type,
        file_size=file.file_size,
        version_number=version.version_number,
        uploaded_by=version.uploaded_by,
        created_at=version.created_at,
        file_url=file_url,
        expires_in=FILE_URL_TTL_SECONDS,
    )


@router.get("/tasks/{task_id}/file", response_model=TaskFileOut)
async def get_task_submitted_file(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Joriy vazifaning o'zi (ijrochi tomonidan) topshirgan eng so'nggi faylini
    qaytaradi. Rejissyor tekshirish uchun, ijrochi esa o'zi nima
    topshirganini qayta ko'rish/tinglash uchun ishlatishi mumkin."""
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vazifa topilmadi")

    episode = await db.get(Episode, task.episode_id)
    season = await db.get(Season, episode.season_id) if episode else None
    project = await get_project_or_404(season.project_id, db) if season else None

    if not (user.is_admin or user.is_super_admin or task.assigned_to == user.id):
        if project is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ruxsat yo'q")
        membership = await get_membership(db, project.id, user.id)
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Siz bu loyiha a'zosi emassiz")

    found = await _active_file_and_version(db, task_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bu vazifa uchun hali fayl topshirilmagan")

    file, version = found
    return await _build_task_file_out(file, version)


@router.get("/episodes/{episode_id}/upstream-file", response_model=TaskFileOut)
async def get_upstream_task_file(
    episode_id: uuid.UUID,
    task_type: TaskType,
    character_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Berilgan `task_type` uchun ish zanjiridagi OLDINGI bosqich natijasini
    qaytaradi (masalan `sound_audio` uchun — shu qismdagi `voice` vazifasi
    topshirgan ovoz fayli). `voice`/`translation` uchun oldingi bosqich
    original video hisoblanadi — bu alohida `/episodes/{id}/original-video`
    endpointi orqali olinadi, shuning uchun bu yerda 404 qaytariladi va
    frontend o'sha endpointga murojaat qiladi.

    `character_id` — faqat `voice`/`sound_audio`/`sound_video` uchun mazmunli
    (bitta qismda bir nechta personaj uchun alohida ovoz/montaj vazifasi
    bo'lishi mumkin); berilmasa, shu turdagi birinchi topilgan vazifa olinadi.
    """
    episode, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    upstream_type = _UPSTREAM_TASK_TYPE.get(task_type)
    if upstream_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bu vazifa turi uchun oldingi bosqich fayli yo'q — original videoni ishlating",
        )

    query = select(Task).where(Task.episode_id == episode_id, Task.task_type == upstream_type)
    if character_id is not None:
        query = query.where(Task.character_id == character_id)
    result = await db.execute(query)
    upstream_task = result.scalars().first()
    if upstream_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oldingi bosqich vazifasi topilmadi")

    found = await _active_file_and_version(db, upstream_task.id)
    if found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Oldingi bosqich hali fayl topshirmagan",
        )

    file, version = found
    return await _build_task_file_out(file, version)
