import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import get_db
from models.characters import Character
from models.projects import Episode, Project, Season
from models.users import User
from models.voice_cues import VoiceCue, VoiceCueStatus
from routers.auth import require_registered_user
from schemas.voice_cues import (
    VoiceCueActorBrief,
    VoiceCueCharacterBrief,
    VoiceCueOut,
    VoiceCueStatusUpdate,
    VoiceCueUpdate,
)
from services.image_processing import validate_and_convert_to_webp
from services.notification_dispatcher import notify
from services.permissions import get_project_or_404, require_project_member
from services import r2_storage

router = APIRouter(tags=["voice-cues"])

_SCREENSHOT_PREFIX = "dub-cues"


async def _get_episode_and_project(db: AsyncSession, episode_id: uuid.UUID) -> tuple[Episode, Project]:
    episode = await db.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Qism topilmadi")
    season = await db.get(Season, episode.season_id)
    project = await get_project_or_404(season.project_id, db)
    return episode, project


async def _get_cue_or_404(db: AsyncSession, cue_id: uuid.UUID) -> VoiceCue:
    cue = await db.get(VoiceCue, cue_id)
    if cue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol topilmadi")
    return cue


async def _cue_out(db: AsyncSession, cue: VoiceCue) -> VoiceCueOut:
    character = None
    if cue.character_id is not None:
        character_obj = await db.get(Character, cue.character_id)
        if character_obj is not None:
            character = VoiceCueCharacterBrief.model_validate(character_obj)

    actor = None
    if cue.actor_id is not None:
        actor_obj = await db.get(User, cue.actor_id)
        if actor_obj is not None:
            actor = VoiceCueActorBrief.model_validate(actor_obj)

    out = VoiceCueOut.model_validate(cue)
    out.screenshot_url = r2_storage.public_url(cue.screenshot_key)
    out.character = character
    out.actor = actor
    return out


async def _validate_character_belongs_to_project(
    db: AsyncSession, character_id: uuid.UUID, project_id: uuid.UUID
) -> None:
    character = await db.get(Character, character_id)
    if character is None or character.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personaj shu loyihaga tegishli emas",
        )


async def _notify_actor_assigned(db: AsyncSession, cue: VoiceCue, episode: Episode) -> None:
    if cue.actor_id is None:
        return
    await notify(
        db,
        user_id=cue.actor_id,
        type_="voice_cue_assigned",
        payload={
            "voice_cue_id": str(cue.id),
            "episode_id": str(cue.episode_id),
            "episode_title": episode.title,
            "timestamp_seconds": cue.timestamp_seconds,
            "director_note": cue.director_note,
        },
    )


# ==================== LIST / CREATE ====================

@router.get("/episodes/{episode_id}/voice-cues", response_model=list[VoiceCueOut])
async def list_episode_cues(
    episode_id: uuid.UUID,
    character_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    status_filter: VoiceCueStatus | None = None,
    created_by_me: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    episode, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    query = select(VoiceCue).where(VoiceCue.episode_id == episode_id)
    if character_id is not None:
        query = query.where(VoiceCue.character_id == character_id)
    if actor_id is not None:
        query = query.where(VoiceCue.actor_id == actor_id)
    if status_filter is not None:
        query = query.where(VoiceCue.status == status_filter)
    if created_by_me:
        query = query.where(VoiceCue.created_by == user.id)

    result = await db.execute(query.order_by(VoiceCue.timestamp_seconds))
    return [await _cue_out(db, cue) for cue in result.scalars().all()]


@router.get("/voice-cues/mine", response_model=list[VoiceCueOut])
async def list_my_cues(
    episode_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    query = select(VoiceCue).where(VoiceCue.actor_id == user.id)
    if episode_id is not None:
        query = query.where(VoiceCue.episode_id == episode_id)
    result = await db.execute(query.order_by(VoiceCue.timestamp_seconds))
    return [await _cue_out(db, cue) for cue in result.scalars().all()]


@router.post(
    "/episodes/{episode_id}/voice-cues",
    response_model=VoiceCueOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_voice_cue(
    episode_id: uuid.UUID,
    screenshot: UploadFile,
    timestamp_seconds: int = Form(...),
    character_id: uuid.UUID | None = Form(None),
    temp_label: str | None = Form(None),
    actor_id: uuid.UUID | None = Form(None),
    director_note: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Multipart: skrinshot fayl + JSON emas, form maydonlari (characters.py
    naqshiga o'xshab, lekin bu yerda qo'shimcha form maydonlari ham bor)."""
    episode, project = await _get_episode_and_project(db, episode_id)
    await require_project_member(project, user, db)

    if character_id is None and not (temp_label and temp_label.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="character_id yoki temp_label kamida bittasi berilishi shart",
        )
    if character_id is not None:
        await _validate_character_belongs_to_project(db, character_id, project.id)

    raw = await screenshot.read()
    webp_bytes = validate_and_convert_to_webp(raw, max_bytes=settings.voice_cue_screenshot_max_bytes)
    screenshot_key = r2_storage.build_object_key(prefix=_SCREENSHOT_PREFIX)
    r2_storage.upload_webp(screenshot_key, webp_bytes)

    cue = VoiceCue(
        id=uuid.uuid4(),
        episode_id=episode_id,
        timestamp_seconds=timestamp_seconds,
        screenshot_key=screenshot_key,
        character_id=character_id,
        temp_label=temp_label,
        actor_id=actor_id,
        director_note=director_note,
        status=VoiceCueStatus.assigned if actor_id is not None else VoiceCueStatus.pending,
        created_by=user.id,
    )
    db.add(cue)
    await db.commit()
    await db.refresh(cue)

    await _notify_actor_assigned(db, cue, episode)

    return await _cue_out(db, cue)


# ==================== UPDATE / STATUS / DELETE ====================

@router.patch("/voice-cues/{cue_id}", response_model=VoiceCueOut)
async def update_voice_cue(
    cue_id: uuid.UUID,
    payload: VoiceCueUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    cue = await _get_cue_or_404(db, cue_id)
    episode, project = await _get_episode_and_project(db, cue.episode_id)
    await require_project_member(project, user, db)

    data = payload.model_dump(exclude_unset=True)

    if "character_id" in data and data["character_id"] is not None:
        await _validate_character_belongs_to_project(db, data["character_id"], project.id)

    new_character_id = data.get("character_id", cue.character_id)
    new_temp_label = data.get("temp_label", cue.temp_label)
    if new_character_id is None and not (new_temp_label and new_temp_label.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="character_id yoki temp_label kamida bittasi berilishi shart",
        )

    old_actor_id = cue.actor_id
    for field, value in data.items():
        setattr(cue, field, value)

    actor_newly_assigned = "actor_id" in data and data["actor_id"] is not None and data["actor_id"] != old_actor_id
    if actor_newly_assigned and cue.status == VoiceCueStatus.pending:
        cue.status = VoiceCueStatus.assigned

    await db.commit()
    await db.refresh(cue)

    if actor_newly_assigned:
        await _notify_actor_assigned(db, cue, episode)

    return await _cue_out(db, cue)


@router.patch("/voice-cues/{cue_id}/status", response_model=VoiceCueOut)
async def update_voice_cue_status(
    cue_id: uuid.UUID,
    payload: VoiceCueStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Faqat cue'ga biriktirilgan aktyor (yoki admin) uchun — va faqat
    assigned -> recorded o'tishi ruxsat etilgan (boshqa hech qanday
    o'tish routerda ruxsat berilmaydi)."""
    cue = await _get_cue_or_404(db, cue_id)

    if not (user.is_admin or user.is_super_admin) and cue.actor_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat shu rolga biriktirilgan aktyor statusni o'zgartira oladi",
        )
    if not (cue.status == VoiceCueStatus.assigned and payload.status == VoiceCueStatus.recorded):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Faqat 'assigned' holatidan 'recorded' holatiga o'tish mumkin",
        )

    cue.status = payload.status
    await db.commit()
    await db.refresh(cue)
    return await _cue_out(db, cue)


@router.delete("/voice-cues/{cue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_cue(
    cue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    cue = await _get_cue_or_404(db, cue_id)
    _, project = await _get_episode_and_project(db, cue.episode_id)
    await require_project_member(project, user, db)

    screenshot_key = cue.screenshot_key
    await db.delete(cue)
    await db.commit()

    r2_storage.delete_object(screenshot_key)
