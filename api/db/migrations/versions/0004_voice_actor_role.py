"""voice_actor project role + project_members.added_at fix

Ikki narsani qo'shadi:
1. `project_role` enumga `voice_actor_main` / `voice_actor_extra` — hozirgacha
   jamoaga faqat rejissyor/tarjimon/ovoz muharriri sifatida a'zo qo'shib
   bo'lardi, "Ovoz aktyori" roli bilan qo'shish imkoni umuman yo'q edi.
2. `project_members.added_at` ustuni — `schemas/projects.py:ProjectMemberOut`
   bu maydonni doim talab qilgan, lekin ustun hech qachon yaratilmagan edi
   (mavjud bug: GET /projects/{id}/members har doim serializatsiya xatosi
   bilan tugardi). Mavjud qatorlar uchun `now()` bilan to'ldiriladi.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL'da "ALTER TYPE ... ADD VALUE" ochiq tranzaksiya ichida
    # bajarilganda yangi qiymat SHU TRANZAKSIYADA ishlatilsa xato beradi.
    # Biz yangi qiymatni shu migratsiyada ishlatmaymiz, lekin xavfsizlik
    # uchun baribir joriy tranzaksiyani committing qilib, DDL'ni alohida
    # avtokommit blokida bajaramiz (Alembic + Postgres uchun tavsiya
    # etilgan andoza).
    op.execute("COMMIT")
    op.execute("ALTER TYPE project_role ADD VALUE IF NOT EXISTS 'voice_actor_main'")
    op.execute("ALTER TYPE project_role ADD VALUE IF NOT EXISTS 'voice_actor_extra'")

    op.add_column(
        "project_members",
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("project_members", "added_at")
    # PostgreSQL'da enum qiymatini olib tashlash to'g'ridan-to'g'ri
    # qo'llab-quvvatlanmaydi (yangi enum yaratib, ustunni ko'chirish kerak
    # bo'ladi). Bu downgrade yo'li ataylab amalga oshirilmagan — production'da
    # zarur bo'lsa qo'lda bajarilishi kerak.
    pass
