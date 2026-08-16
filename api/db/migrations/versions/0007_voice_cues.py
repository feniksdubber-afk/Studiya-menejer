"""voice_cues table ("Rollar")

Rejissyor video ko'rib chiqayotib yaratadigan "rol" cue'larini saqlaydi:
skrinshot (R2) + vaqt + (personaj yoki vaqtinchalik nom) + aktyor + izoh +
status (pending -> assigned -> recorded). Batafsil: VOICE-CUES-PLAN.md.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

voice_cue_status = sa.Enum("pending", "assigned", "recorded", name="voice_cue_status")


def upgrade() -> None:
    op.create_table(
        "voice_cues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "episode_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("episodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("timestamp_seconds", sa.Integer(), nullable=False),
        sa.Column("screenshot_key", sa.String(512), nullable=False),
        sa.Column(
            "character_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("characters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("temp_label", sa.String(256), nullable=True),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("director_note", sa.Text(), nullable=True),
        sa.Column("status", voice_cue_status, nullable=False, server_default="pending"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "character_id IS NOT NULL OR temp_label IS NOT NULL",
            name="ck_voice_cues_character_or_temp_label",
        ),
    )

    op.create_index("ix_voice_cues_episode_id", "voice_cues", ["episode_id"])
    op.create_index("ix_voice_cues_actor_id", "voice_cues", ["actor_id"])
    op.create_index(
        "ix_voice_cues_episode_timestamp", "voice_cues", ["episode_id", "timestamp_seconds"]
    )


def downgrade() -> None:
    op.drop_index("ix_voice_cues_episode_timestamp", table_name="voice_cues")
    op.drop_index("ix_voice_cues_actor_id", table_name="voice_cues")
    op.drop_index("ix_voice_cues_episode_id", table_name="voice_cues")
    op.drop_table("voice_cues")
    voice_cue_status.drop(op.get_bind())
