import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import get_db
from models.characters import Character, CharacterCast, ImageSource
from models.projects import Project
from models.users import User
from routers.auth import require_registered_user
from schemas.characters import (
    CastMemberUser,
    CharacterCastAdd,
    CharacterCastOut,
    CharacterCreate,
    CharacterOut,
    CharacterUpdate,
)
from services.image_processing import validate_and_convert_to_webp
from services.permissions import (
    get_membership,
    get_project_or_404,
    is_project_director,
    require_project_director,
)
from services import r2_storage

router = APIRouter(tags=["characters"])


def _with_display_url(character: Character, can_manage: bool = False) -> CharacterOut:
    out = CharacterOut.model_validate(character)
    if character.image_source == ImageSource.custom and character.custom_image_key:
        out.display_image_url = r2_storage.public_url(character.custom_image_key)
    else:
        out.display_image_url = character.anilist_image_url
    out.can_manage = can_manage
    return out


async def _check_view_access(db: AsyncSession, project: Project, user: User) -> None:
    if user.is_admin or user.is_super_admin:
        return
    membership = await get_membership(db, project.id, user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Siz bu loyiha a'zosi emassiz")


@router.get("/projects/{project_id}/characters", response_model=list[CharacterOut])
async def list_characters(
    project_id: uuid.UUID,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    project = await get_project_or_404(project_id, db)
    await _check_view_access(db, project, user)

    query = select(Character).where(Character.project_id == project_id)
    if not include_inactive:
        query = query.where(Character.is_active.is_(True))
    result = await db.execute(query.order_by(Character.name))
    can_manage = await is_project_director(db, project.id, user)
    return [_with_display_url(c, can_manage) for c in result.scalars().all()]


@router.post(
    "/projects/{project_id}/characters",
    response_model=CharacterOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_character(
    project_id: uuid.UUID,
    payload: CharacterCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    project = await get_project_or_404(project_id, db)
    await require_project_director(project, user, db)

    character = Character(
        id=uuid.uuid4(),
        project_id=project_id,
        name=payload.name,
        anilist_original_name=payload.anilist_original_name,
        anilist_image_url=payload.anilist_image_url,
        image_source=ImageSource.anilist,
        created_by=user.id,
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return _with_display_url(character, can_manage=True)


async def _get_character_or_404(db: AsyncSession, character_id: uuid.UUID) -> Character:
    character = await db.get(Character, character_id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personaj topilmadi")
    return character


@router.get("/characters/{character_id}", response_model=CharacterOut)
async def get_character(
    character_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await _check_view_access(db, project, user)
    can_manage = await is_project_director(db, project.id, user)
    return _with_display_url(character, can_manage)


@router.patch("/characters/{character_id}", response_model=CharacterOut)
async def update_character(
    character_id: uuid.UUID,
    payload: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await require_project_director(project, user, db)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(character, field, value)
    await db.commit()
    await db.refresh(character)
    return _with_display_url(character, can_manage=True)


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Personajni butunlay o'chirish o'rniga odatda is_active=false qilingani
    ma'qul (voice history saqlanishi uchun). Bu endpoint faqat hali hech
    qanday task/cast bilan bog'lanmagan personajlar uchun xavfsiz."""
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await require_project_director(project, user, db)

    result = await db.execute(select(CharacterCast).where(CharacterCast.character_id == character_id))
    if result.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Personajga aktyor biriktirilgan — o'chirish o'rniga faolsizlantiring (is_active=false)",
        )
    await db.delete(character)
    await db.commit()


# ==================== CHARACTER IMAGE (R2) ====================

@router.post("/characters/{character_id}/image", response_model=CharacterOut)
async def upload_character_image(
    character_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Personaj uchun maxsus rasm yuklash — faqat rejissyor/admin (§6.1).

    Oqim: hajm/format validatsiya -> Pillow orqali decode-qayta-encode
    (haqiqiy piksel ma'lumotidan WebP yasaladi, EXIF/metadata avtomatik
    yo'qoladi) -> R2'ga yuklash -> eski custom rasm (bo'lsa) o'chiriladi ->
    DB yangilanadi. Original fayl hech qachon saqlanmaydi.
    """
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await require_project_director(project, user, db)

    raw = await file.read()
    webp_bytes = validate_and_convert_to_webp(raw, max_bytes=settings.character_image_max_bytes)

    new_key = r2_storage.build_object_key()
    r2_storage.upload_webp(new_key, webp_bytes)

    old_key = character.custom_image_key if character.image_source == ImageSource.custom else None

    character.custom_image_key = new_key
    character.image_source = ImageSource.custom
    await db.commit()
    await db.refresh(character)

    if old_key:
        r2_storage.delete_object(old_key)

    return _with_display_url(character, can_manage=True)


@router.delete("/characters/{character_id}/image", response_model=CharacterOut)
async def delete_character_image(
    character_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    """Custom rasmni o'chiradi va personajni AniList original rasmiga
    qaytaradi (AniList rasm hech qachon o'chirilmaydi — faqat manba)."""
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await require_project_director(project, user, db)

    if character.image_source != ImageSource.custom or not character.custom_image_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Personajda custom rasm yo'q")

    old_key = character.custom_image_key
    character.custom_image_key = None
    character.image_source = ImageSource.anilist
    await db.commit()
    await db.refresh(character)

    r2_storage.delete_object(old_key)

    return _with_display_url(character, can_manage=True)


# ==================== CHARACTER CAST ====================

@router.get("/characters/{character_id}/cast", response_model=list[CharacterCastOut])
async def list_character_cast(
    character_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await _check_view_access(db, project, user)

    # CharacterCast'da user'ga SQLAlchemy relationship yo'q (ataylab —
    # oddiy FK), shuning uchun bu yerda User bilan qo'lda JOIN qilib,
    # frontend N+1 so'rov yubormasligi uchun ism/username'ni birga qaytaramiz.
    result = await db.execute(
        select(CharacterCast, User)
        .join(User, User.id == CharacterCast.user_id)
        .where(CharacterCast.character_id == character_id)
        .order_by(CharacterCast.cast_type)
    )
    return [
        CharacterCastOut(
            id=cast.id,
            character_id=cast.character_id,
            user_id=cast.user_id,
            cast_type=cast.cast_type,
            user=CastMemberUser.model_validate(cast_user),
        )
        for cast, cast_user in result.all()
    ]


@router.post(
    "/characters/{character_id}/cast",
    response_model=CharacterCastOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_character_cast(
    character_id: uuid.UUID,
    payload: CharacterCastAdd,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await require_project_director(project, user, db)

    target_user = await db.get(User, payload.user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foydalanuvchi topilmadi")

    existing = await db.execute(
        select(CharacterCast).where(
            CharacterCast.character_id == character_id,
            CharacterCast.user_id == payload.user_id,
        )
    )
    if existing.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu aktyor allaqachon shu personajga biriktirilgan",
        )

    cast = CharacterCast(
        id=uuid.uuid4(),
        character_id=character_id,
        user_id=payload.user_id,
        cast_type=payload.cast_type,
    )
    db.add(cast)
    try:
        await db.commit()
    except IntegrityError:
        # Yuqoridagi tekshiruv ("avval tekshir, keyin qo'sh") race
        # condition'ga ochiq -- DB darajasidagi unique constraint
        # (uq_character_cast_character_user, 0005 migratsiyasi) yakuniy
        # himoya chizig'i bo'lib xizmat qiladi.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu aktyor allaqachon shu personajga biriktirilgan",
        )
    await db.refresh(cast)
    return CharacterCastOut(
        id=cast.id,
        character_id=cast.character_id,
        user_id=cast.user_id,
        cast_type=cast.cast_type,
        user=CastMemberUser.model_validate(target_user),
    )


@router.delete("/characters/{character_id}/cast/{cast_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_character_cast(
    character_id: uuid.UUID,
    cast_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_registered_user),
):
    character = await _get_character_or_404(db, character_id)
    project = await get_project_or_404(character.project_id, db)
    await require_project_director(project, user, db)

    cast = await db.get(CharacterCast, cast_id)
    if cast is None or cast.character_id != character_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast yozuvi topilmadi")
    await db.delete(cast)
    await db.commit()
