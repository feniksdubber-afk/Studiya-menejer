"""users.phone_number (V1: Telegram contact-share orqali registratsiyada)

Ro'yxatdan o'tish oqimiga telefon raqami bosqichi qo'shildi (bot/handlers/
registration.py). Foydalanuvchi raqamni qo'lda yozmaydi — Telegram'ning
"Raqamni ulashish" tugmasi orqali yuboradi, shuning uchun format har doim
E.164 ko'rinishida (+998901234567) keladi va bot tomonda qo'shimcha
normalizatsiya qilinadi.

Nullable qilib qo'yilgan, chunki mavjud (allaqachon ro'yxatdan o'tgan)
foydalanuvchilarda bu maydon bo'sh bo'ladi — ularni majburiy to'ldirishga
majburlash alohida migratsiya masalasi emas.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_number", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone_number")
