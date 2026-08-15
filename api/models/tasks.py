import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, uuid_pk


class TaskType(str, enum.Enum):
    translation = "translation"
    voice = "voice"
    sound_video = "sound_video"
    sound_audio = "sound_audio"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    submitted = "submitted"
    revision_requested = "revision_requested"
    accepted = "accepted"
    delayed = "delayed"


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = uuid_pk()
    episode_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("episodes.id", ondelete="CASCADE"))
    task_type: Mapped[TaskType] = mapped_column(Enum(TaskType, name="task_type"), nullable=False)
    character_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL")
    )
    assigned_to: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus, name="task_status"), default=TaskStatus.pending)
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notified_3h: Mapped[bool] = mapped_column(Boolean, default=False)
    revision_reason: Mapped[str | None] = mapped_column(Text)


class DeadlineHistory(Base):
    __tablename__ = "deadline_history"

    id: Mapped[uuid.UUID] = uuid_pk()
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"))
    old_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    new_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
