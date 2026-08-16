import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.files import FileKind, VersionStatus


class InternalFileSubmit(BaseModel):
    """Bot `/internal/files` orqali fayl topshirilganda yuboradigan payload.
    Binary hech qachon kelmaydi — faqat Telegram file_id + metadata."""

    task_id: uuid.UUID
    uploaded_by: uuid.UUID  # users.id (bot buni telegram_id orqali topib yuboradi)
    telegram_file_id: str = Field(min_length=1, max_length=512)
    telegram_message_id: int
    file_name: str = Field(min_length=1, max_length=512)
    mime_type: str | None = None
    file_size: int | None = None


class FileVersionOut(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    version_number: int
    telegram_file_id: str
    file_name: str
    uploaded_by: uuid.UUID
    is_active: bool
    status: VersionStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class FileOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID | None
    episode_id: uuid.UUID | None
    project_id: uuid.UUID | None
    owner_id: uuid.UUID
    file_kind: FileKind
    current_name: str
    mime_type: str | None
    file_size: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FileSubmitResult(BaseModel):
    file: FileOut
    version: FileVersionOut
    task_status: str
    task_current_version: int


# ==================== ORIGINAL VIDEO (V1: R2 presigned upload) ====================

class OriginalVideoUploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=512)
    mime_type: str = Field(min_length=1, max_length=128)


class OriginalVideoUploadUrlOut(BaseModel):
    upload_url: str
    r2_key: str
    expires_in: int


class OriginalVideoConfirm(BaseModel):
    r2_key: str = Field(min_length=1, max_length=512)
    file_name: str = Field(min_length=1, max_length=512)
    mime_type: str = Field(min_length=1, max_length=128)


class OriginalVideoOut(BaseModel):
    id: uuid.UUID
    episode_id: uuid.UUID | None
    current_name: str
    mime_type: str | None
    file_size: int | None
    owner_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class OriginalVideoPlaybackOut(BaseModel):
    video_url: str
    expires_in: int


# ==================== TASK/UPSTREAM FILE PLAYBACK (Telegram getFile orqali) ====================
# Tarjimon/ovoz aktyori/svedeniyachi ish oqimida oldingi bosqich natijasini
# (masalan tarjimon uchun original video, svedeniyachi uchun ovoz fayli)
# yoki joriy vazifaning o'zi topshirgan faylini Mini App ichida to'g'ridan-
# to'g'ri ko'rish/eshitish/yuklab olish uchun. Binary hech qachon bizning
# serverimizda saqlanmaydi — Telegram Bot API `getFile` orqali vaqtinchalik
# (bir necha soatlik) havola olinadi va shundayligicha frontendga beriladi.


class TaskFileOut(BaseModel):
    file_id: uuid.UUID
    task_id: uuid.UUID | None
    file_kind: FileKind
    current_name: str
    mime_type: str | None
    file_size: int | None
    version_number: int
    uploaded_by: uuid.UUID
    created_at: datetime
    # Telegram fayl havolasi — 1 soatgacha amal qiladi (Telegram serverida
    # shu muddatdan keyin file_path eskiradi, qayta so'rash kerak bo'ladi).
    file_url: str
    expires_in: int
