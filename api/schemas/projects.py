import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.projects import EpisodeStatus, ProjectRole, ProjectType
from schemas.auth import UserBrief


# ---------- Project ----------

class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    type: ProjectType
    poster_url: str | None = None
    anilist_id: int | None = None


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    type: ProjectType | None = None
    poster_url: str | None = None
    anilist_id: int | None = None
    is_archived: bool | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    title: str
    type: ProjectType
    poster_url: str | None
    anilist_id: int | None
    is_archived: bool
    created_by: uuid.UUID
    created_at: datetime

    # Joriy foydalanuvchi AYNAN shu loyihada boshqarish huquqiga egami
    # (admin/super_admin yoki shu loyihaning director_main/director_extra
    # a'zosi). Frontend global user.role'ga emas, shu maydonga qarab UI
    # ko'rsatishi kerak — router javob qaytarishda to'ldiradi.
    can_manage: bool = False

    model_config = {"from_attributes": True}


# ---------- Project members ----------

class ProjectMemberAdd(BaseModel):
    user_id: uuid.UUID
    role_in_project: ProjectRole


class ProjectMemberOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role_in_project: ProjectRole
    added_at: datetime
    user: UserBrief

    model_config = {"from_attributes": True}


# ---------- Season ----------

class SeasonCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    order_index: int = 0
    anilist_season_id: int | None = None


class SeasonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    order_index: int | None = None
    anilist_season_id: int | None = None


class SeasonOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    order_index: int
    anilist_season_id: int | None

    model_config = {"from_attributes": True}


# ---------- Episode ----------

class EpisodeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    order_index: int = 0


class EpisodeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    order_index: int | None = None
    # status qo'lda o'zgartirilmaydi — task_engine avtomatik hisoblaydi.
    # Faqat admin/rejissyor uchun favqulodda qo'lda override (kamdan-kam ishlatiladi).
    status: EpisodeStatus | None = None


class EpisodeOut(BaseModel):
    id: uuid.UUID
    season_id: uuid.UUID
    title: str
    order_index: int
    status: EpisodeStatus
    created_at: datetime

    model_config = {"from_attributes": True}
