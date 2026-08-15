"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger, nullable=False, unique=True),
        sa.Column("first_name", sa.String(128), nullable=False),
        sa.Column("last_name", sa.String(128)),
        sa.Column("telegram_username", sa.String(128)),
        sa.Column(
            "role",
            sa.Enum("director", "translator", "voice_actor", "sound_editor", name="user_role"),
            nullable=True,
        ),
        sa.Column("is_registered", sa.Boolean, server_default="false", nullable=False),
        sa.Column(
            "director_status",
            sa.Enum("none", "pending", "approved", "rejected", name="director_status"),
            server_default="none",
            nullable=False,
        ),
        sa.Column("director_approved", sa.Boolean, server_default="false", nullable=False),
        sa.Column("is_admin", sa.Boolean, server_default="false", nullable=False),
        sa.Column("is_super_admin", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"])

    # --- projects ---
    op.create_table(
        "projects",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column(
            "type",
            sa.Enum("anime", "series", "movie", "cartoon", "other", name="project_type"),
            nullable=False,
        ),
        sa.Column("poster_url", sa.String(1024)),
        sa.Column("anilist_id", sa.Integer),
        sa.Column("created_by", pg.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "project_members",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "role_in_project",
            sa.Enum(
                "director_main", "director_extra", "translator_main",
                "translator_extra", "sound_main", "sound_extra",
                name="project_role",
            ),
            nullable=False,
        ),
    )
    op.create_index("ix_project_members_project", "project_members", ["project_id"])
    op.create_index("ix_project_members_user", "project_members", ["user_id"])

    # --- seasons / episodes ---
    op.create_table(
        "seasons",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("order_index", sa.Integer, server_default="0"),
        sa.Column("anilist_season_id", sa.Integer),
    )
    op.create_index("ix_seasons_project", "seasons", ["project_id"])

    op.create_table(
        "episodes",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("season_id", pg.UUID(as_uuid=True), sa.ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("order_index", sa.Integer, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("not_started", "in_progress", "revision", "ready", "delayed", name="episode_status"),
            server_default="not_started",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_episodes_season", "episodes", ["season_id"])

    # --- characters (R2 maydonlari bilan) ---
    op.create_table(
        "characters",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("anilist_original_name", sa.String(256)),
        sa.Column("anilist_image_url", sa.String(1024)),
        sa.Column("custom_image_key", sa.String(512)),  # R2 key, masalan characters/<uuid>.webp
        sa.Column(
            "image_source",
            sa.Enum("anilist", "custom", name="image_source"),
            server_default="anilist",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_by", pg.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_characters_project", "characters", ["project_id"])

    op.create_table(
        "character_cast",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("character_id", pg.UUID(as_uuid=True), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cast_type", sa.Enum("main", "alternate", name="cast_type"), nullable=False),
    )
    op.create_index("ix_character_cast_character", "character_cast", ["character_id"])

    # --- tasks ---
    op.create_table(
        "tasks",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("episode_id", pg.UUID(as_uuid=True), sa.ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "task_type",
            sa.Enum("translation", "voice", "sound_video", "sound_audio", name="task_type"),
            nullable=False,
        ),
        sa.Column("character_id", pg.UUID(as_uuid=True), sa.ForeignKey("characters.id", ondelete="SET NULL")),
        sa.Column("assigned_to", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "submitted", "revision_requested", "accepted", "delayed", name="task_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("current_version", sa.Integer, server_default="0"),
        sa.Column("deadline", sa.DateTime(timezone=True)),
        sa.Column("notified_3h", sa.Boolean, server_default="false"),
        sa.Column("revision_reason", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tasks_episode", "tasks", ["episode_id"])
    op.create_index("ix_tasks_assigned_to", "tasks", ["assigned_to"])
    op.create_index("ix_tasks_deadline", "tasks", ["deadline"])

    op.create_table(
        "deadline_history",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", pg.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("old_deadline", sa.DateTime(timezone=True)),
        sa.Column("new_deadline", sa.DateTime(timezone=True)),
        sa.Column("reason", sa.Text),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- folders ---
    op.create_table(
        "folders",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", pg.UUID(as_uuid=True), sa.ForeignKey("folders.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("is_default", sa.Boolean, server_default="false"),
        sa.Column("created_by", pg.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- files (faqat Telegram file_id, binary yo'q) ---
    op.create_table(
        "files",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("telegram_file_id", sa.String(512), nullable=False),
        sa.Column("telegram_message_id", sa.BigInteger, nullable=False),
        sa.Column("original_name", sa.String(512), nullable=False),
        sa.Column("current_name", sa.String(512), nullable=False),
        sa.Column("mime_type", sa.String(128)),
        sa.Column("file_size", sa.BigInteger),
        sa.Column("owner_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("episode_id", pg.UUID(as_uuid=True), sa.ForeignKey("episodes.id", ondelete="CASCADE")),
        sa.Column("task_id", pg.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="SET NULL")),
        sa.Column("folder_id", pg.UUID(as_uuid=True), sa.ForeignKey("folders.id", ondelete="SET NULL")),
        sa.Column(
            "file_kind",
            sa.Enum(
                "original_video", "translation", "voice", "sound_video", "sound_audio", "other",
                name="file_kind",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_files_episode", "files", ["episode_id"])
    op.create_index("ix_files_task", "files", ["task_id"])

    op.create_table(
        "file_versions",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("file_id", pg.UUID(as_uuid=True), sa.ForeignKey("files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("telegram_file_id", sa.String(512), nullable=False),
        sa.Column("file_name", sa.String(512), nullable=False),
        sa.Column("uploaded_by", pg.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "superseded", "deleted", name="version_status"),
            server_default="active",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_file_versions_file", "file_versions", ["file_id"])
    # Bitta file uchun faqat bitta aktiv versiya bo'lishi mumkin (§16)
    op.execute(
        "CREATE UNIQUE INDEX uq_file_versions_active ON file_versions(file_id) WHERE is_active"
    )

    # --- notifications / comments / mentions / activity_logs ---
    op.create_table(
        "notifications",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("payload", pg.JSONB, server_default="{}"),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user", "notifications", ["user_id", "is_read"])

    op.create_table(
        "comments",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("episode_id", pg.UUID(as_uuid=True), sa.ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "mentions",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("comment_id", pg.UUID(as_uuid=True), sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mentioned_user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    )

    op.create_table(
        "activity_logs",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", pg.UUID(as_uuid=True)),
        sa.Column("meta", pg.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_activity_logs_entity", "activity_logs", ["entity_type", "entity_id"])


def downgrade() -> None:
    op.drop_table("activity_logs")
    op.drop_table("mentions")
    op.drop_table("comments")
    op.drop_table("notifications")
    op.drop_index("uq_file_versions_active", table_name="file_versions")
    op.drop_table("file_versions")
    op.drop_table("files")
    op.drop_table("folders")
    op.drop_table("deadline_history")
    op.drop_table("tasks")
    op.drop_table("character_cast")
    op.drop_table("characters")
    op.drop_table("episodes")
    op.drop_table("seasons")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("users")

    for enum_name in [
        "user_role", "director_status", "project_type", "project_role", "episode_status",
        "image_source", "cast_type", "task_type", "task_status", "file_kind", "version_status",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
