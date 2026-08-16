import enum
import uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, uuid_pk


class VoiceCueStatus(str, enum.Enum):
    pending = "pending"      # hali aktyor biriktirilmagan
    assigned = "assigned"    # actor_id bor, hali yozilmagan
    recorded = "recorded"    # aktyor "Yozib bo'ldim" bosgan


class VoiceCue(Base, TimestampMixin):
    """Rejissyor video ko'rib chiqayotib yaratadigan "rol" — bitta skrinshot +
    vaqt + (personaj/aktyor) + izoh. Aktyor o'z vazifasi ichida shu cue'larni
    tartiblangan holda ko'rib ovoz beradi (VOICE-CUES-PLAN.md).
    """

    __tablename__ = "voice_cues"

    id: Mapped[uuid.UUID] = uuid_pk()
    episode_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False
    )
    timestamp_seconds: Mapped[int] = mapped_column(Integer, nullable=False)

    # R2 kalit: dub-cues/<uuid>.webp (r2_storage.build_object_key prefix="dub-cues")
    screenshot_key: Mapped[str] = mapped_column(String(512), nullable=False)

    character_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL")
    )
    # Personaj hali tanilmagan bo'lsa ("Notanish ayol") — character_id yoki
    # temp_label'dan kamida bittasi bo'lishi shart (pastdagi CHECK constraint).
    temp_label: Mapped[str | None] = mapped_column(String(256))

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    director_note: Mapped[str | None] = mapped_column(Text)

    status: Mapped[VoiceCueStatus] = mapped_column(
        Enum(VoiceCueStatus, name="voice_cue_status"), nullable=False, default=VoiceCueStatus.pending
    )
    # Asosiy sort — timestamp_seconds. order_index qo'lda tartiblash uchun zaxira.
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "character_id IS NOT NULL OR temp_label IS NOT NULL",
            name="ck_voice_cues_character_or_temp_label",
        ),
    )
