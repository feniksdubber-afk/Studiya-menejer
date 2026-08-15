import enum
import uuid

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, uuid_pk


class FileKind(str, enum.Enum):
    original_video = "original_video"
    translation = "translation"
    voice = "voice"
    sound_video = "sound_video"
    sound_audio = "sound_audio"
    other = "other"


class VersionStatus(str, enum.Enum):
    active = "active"
    superseded = "superseded"
    deleted = "deleted"


class Folder(Base, TimestampMixin):
    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class File(Base, TimestampMixin):
    """Faqat Telegram file_id + metadata. Binary hech qachon serverga tushmaydi."""

    __tablename__ = "files"

    id: Mapped[uuid.UUID] = uuid_pk()
    telegram_file_id: Mapped[str] = mapped_column(String(512), nullable=False)
    telegram_message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    original_name: Mapped[str] = mapped_column(String(512), nullable=False)
    current_name: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(128))
    file_size: Mapped[int | None] = mapped_column(BigInteger)

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    episode_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("episodes.id", ondelete="CASCADE"))
    task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"))
    folder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"))

    file_kind: Mapped[FileKind] = mapped_column(Enum(FileKind, name="file_kind"), nullable=False)


class FileVersion(Base, TimestampMixin):
    __tablename__ = "file_versions"

    id: Mapped[uuid.UUID] = uuid_pk()
    file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    telegram_file_id: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[VersionStatus] = mapped_column(Enum(VersionStatus, name="version_status"), default=VersionStatus.active)

    # Muhim: aktiv versiya bittagina bo'lishi kerak (bitta file uchun).
    # DB darajasida: partial unique index quyidagi Alembic migratsiyada qo'shiladi:
    #   CREATE UNIQUE INDEX uq_file_versions_active ON file_versions(file_id) WHERE is_active;
