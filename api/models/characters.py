import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, uuid_pk


class ImageSource(str, enum.Enum):
    anilist = "anilist"
    custom = "custom"


class CastType(str, enum.Enum):
    main = "main"
    alternate = "alternate"


class Character(Base, TimestampMixin):
    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    anilist_original_name: Mapped[str | None] = mapped_column(String(256))

    # R2: faqat WebP saqlanadi, original upload fayli saqlanmaydi
    anilist_image_url: Mapped[str | None] = mapped_column(String(1024))
    custom_image_key: Mapped[str | None] = mapped_column(String(512))  # masalan: characters/<uuid>.webp
    image_source: Mapped[ImageSource] = mapped_column(
        Enum(ImageSource, name="image_source"), default=ImageSource.anilist
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class CharacterCast(Base):
    __tablename__ = "character_cast"

    id: Mapped[uuid.UUID] = uuid_pk()
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    cast_type: Mapped[CastType] = mapped_column(Enum(CastType, name="cast_type"), nullable=False)
