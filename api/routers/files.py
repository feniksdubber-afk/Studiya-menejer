import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import get_db
from models.files import File, FileKind
from models.projects import Episode, Project, Season
from models.users import User
from routers.auth import require_registered_user
from schemas.files import (
    OriginalVideoConfirm,
    OriginalVideoOut,
    OriginalVideoPlaybackOut,
    OriginalVideoUploadUrlOut,
    OriginalVideoUploadUrlRequest,
)
from services.permissions import get_project_or_404, is_project_director, require_project_member
from services import r2_storage

router = APIRouter(tags=["files"])


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
