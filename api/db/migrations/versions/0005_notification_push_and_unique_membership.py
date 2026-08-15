"""notifications.pushed_at + unique membership constraints

Ikki narsani qo'shadi:

1. `notifications.pushed_at` — Telegram orqali push xabar allaqachon
   yuborilganmi degan belgi (nullable datetime, hali yuborilmagan bo'lsa
   NULL). `is_read`dan ataylab farqli ustun: `is_read` "foydalanuvchi Mini
   App'da ko'rdimi" degan ma'noni bildirishi kerak (kelajakda), `pushed_at`
   esa "bot Telegram orqali yuborib bo'ldimi" degan ma'noni bildiradi.
   Bot/services/notification_pusher.py shu ustun bo'yicha hali push
   qilinmagan yozuvlarni topib, Telegram orqali yetkazadi.

2. `project_members(project_id, user_id)` va
   `character_cast(character_id, user_id)` bo'yicha unique constraint —
   ilgari faqat ilova darajasida ("avval tekshir, keyin qo'sh") himoyalangan
   edi, bu esa race condition orqali bitta odamni ikki marta a'zo/aktyor
   qilib qo'yishi mumkin edi. Constraint qo'shishdan oldin mavjud
   dublikatlar (agar bo'lsa) eng eski yozuvni qoldirib tozalanadi, aks
   holda migratsiya xato beradi.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("pushed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Constraint qo'shishdan oldin ehtimoliy dublikatlarni tozalash —
    # eng birinchi (eng eski `id`) yozuv qoldiriladi, qolganlari o'chiriladi.
    op.execute(
        """
        DELETE FROM project_members pm
        USING project_members pm2
        WHERE pm.project_id = pm2.project_id
          AND pm.user_id = pm2.user_id
          AND pm.id > pm2.id
        """
    )
    op.execute(
        """
        DELETE FROM character_cast cc
        USING character_cast cc2
        WHERE cc.character_id = cc2.character_id
          AND cc.user_id = cc2.user_id
          AND cc.id > cc2.id
        """
    )

    op.create_unique_constraint(
        "uq_project_members_project_user",
        "project_members",
        ["project_id", "user_id"],
    )
    op.create_unique_constraint(
        "uq_character_cast_character_user",
        "character_cast",
        ["character_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_character_cast_character_user", "character_cast", type_="unique")
    op.drop_constraint("uq_project_members_project_user", "project_members", type_="unique")
    op.drop_column("notifications", "pushed_at")
