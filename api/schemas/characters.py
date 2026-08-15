import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.characters import CastType, ImageSource
from schemas.auth import UserBrief


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    anilist_original_name: str | None = None
    anilist_image_url: str | None = None  # AniList'dan import qilinganda


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    anilist_original_name: str | None = None
    is_active: bool | None = None


class CharacterOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    anilist_original_name: str | None
    anilist_image_url: str | None
    custom_image_key: str | None
    image_source: ImageSource
    is_active: bool
    created_by: uuid.UUID
    created_at: datetime

    # Frontend uchun ko'rsatiladigan yakuniy rasm URL (custom bo'lsa R2 public URL,
    # aks holda anilist_image_url). Router javob qaytarishda to'ldiradi.
    display_image_url: str | None = None

    # Joriy foydalanuvchi shu personaj tegishli loyihada boshqarish huquqiga
    # egami (qarang: ProjectOut.can_manage).
    can_manage: bool = False

    model_config = {"from_attributes": True}


class CharacterCastAdd(BaseModel):
    user_id: uuid.UUID
    cast_type: CastType = CastType.main


# Backward-compat nom — router va boshqa joylarda shu nom bilan ishlatiladi.
CastMemberUser = UserBrief


class CharacterCastOut(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    user_id: uuid.UUID
    cast_type: CastType
    user: UserBrief

    model_config = {"from_attributes": True}
