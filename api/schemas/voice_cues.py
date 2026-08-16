import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from models.voice_cues import VoiceCueStatus


class VoiceCueCharacterBrief(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class VoiceCueActorBrief(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str | None
    telegram_username: str | None

    model_config = {"from_attributes": True}


class VoiceCueCreate(BaseModel):
    """Skrinshot alohida `multipart/form-data` fayl sifatida keladi (router
    `UploadFile` bilan qabul qiladi) — bu qismning maydonlari form field
    sifatida yuboriladi. `episode_id` URL path'dan keladi, bu yerda kerak
    emas."""

    timestamp_seconds: int = Field(ge=0)
    character_id: uuid.UUID | None = None
    temp_label: str | None = Field(default=None, max_length=256)
    actor_id: uuid.UUID | None = None
    director_note: str | None = None

    @model_validator(mode="after")
    def _character_or_temp_label(self) -> "VoiceCueCreate":
        if self.character_id is None and not (self.temp_label and self.temp_label.strip()):
            raise ValueError("character_id yoki temp_label kamida bittasi berilishi shart")
        return self


class VoiceCueUpdate(BaseModel):
    timestamp_seconds: int | None = Field(default=None, ge=0)
    character_id: uuid.UUID | None = None
    temp_label: str | None = Field(default=None, max_length=256)
    actor_id: uuid.UUID | None = None
    director_note: str | None = None


class VoiceCueStatusUpdate(BaseModel):
    status: VoiceCueStatus


class VoiceCueOut(BaseModel):
    id: uuid.UUID
    episode_id: uuid.UUID
    timestamp_seconds: int
    screenshot_url: str | None
    character: VoiceCueCharacterBrief | None = None
    temp_label: str | None
    actor: VoiceCueActorBrief | None = None
    director_note: str | None
    status: VoiceCueStatus
    order_index: int
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
