import enum
import uuid

from sqlalchemy import BigInteger, Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, uuid_pk


class UserRole(str, enum.Enum):
    director = "director"
    translator = "translator"
    voice_actor = "voice_actor"
    sound_editor = "sound_editor"


class DirectorStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(128), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(128))
    telegram_username: Mapped[str | None] = mapped_column(String(128))

    # NULL = Telegram orqali auth qilingan, lekin ro'yxatdan hali to'liq
    # o'tmagan (rol/ism bot FSM orqali keyingi bosqichda to'ldiriladi).
    role: Mapped[UserRole | None] = mapped_column(Enum(UserRole, name="user_role"), nullable=True)
    is_registered: Mapped[bool] = mapped_column(Boolean, default=False)

    director_status: Mapped[DirectorStatus] = mapped_column(
        Enum(DirectorStatus, name="director_status"), default=DirectorStatus.none
    )
    director_approved: Mapped[bool] = mapped_column(Boolean, default=False)

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False)
