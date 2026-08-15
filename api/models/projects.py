import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, uuid_pk


class ProjectType(str, enum.Enum):
    anime = "anime"
    series = "series"
    movie = "movie"
    cartoon = "cartoon"
    other = "other"


class ProjectRole(str, enum.Enum):
    director_main = "director_main"
    director_extra = "director_extra"
    translator_main = "translator_main"
    translator_extra = "translator_extra"
    voice_actor_main = "voice_actor_main"
    voice_actor_extra = "voice_actor_extra"
    sound_main = "sound_main"
    sound_extra = "sound_extra"


class EpisodeStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    revision = "revision"
    ready = "ready"
    delayed = "delayed"


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    type: Mapped[ProjectType] = mapped_column(Enum(ProjectType, name="project_type"), nullable=False)
    poster_url: Mapped[str | None] = mapped_column(String(1024))
    anilist_id: Mapped[int | None] = mapped_column(Integer)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role_in_project: Mapped[ProjectRole] = mapped_column(Enum(ProjectRole, name="project_role"), nullable=False)
    # MUHIM: schemas/projects.py:ProjectMemberOut bu maydonni doim talab qilib
    # kelgan, lekin ustunning o'zi yaratilmagan edi — a'zolar ro'yxatini olish
    # amalda xato bilan tugardi. 0004 migratsiyasi shu ustunni qo'shadi.
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    anilist_season_id: Mapped[int | None] = mapped_column(Integer)


class Episode(Base, TimestampMixin):
    __tablename__ = "episodes"

    id: Mapped[uuid.UUID] = uuid_pk()
    season_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("seasons.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[EpisodeStatus] = mapped_column(
        Enum(EpisodeStatus, name="episode_status"), default=EpisodeStatus.not_started
    )
