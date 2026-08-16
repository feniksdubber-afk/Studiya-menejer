"""files.r2_key + telegram fields nullable (V1: video R2 storage)

V1 bosqichi: original video endi brauzerdan to'g'ridan-to'g'ri R2'ga
(presigned PUT) yuklanadi, Telegram bot bu oqimda ishtirok etmaydi.
Shu sababli:
  - `files.r2_key` qo'shiladi (faqat file_kind=original_video uchun
    to'ldiriladi: dub-videos/<uuid>.<ext>)
  - `files.telegram_file_id` va `files.telegram_message_id` NULLABLE
    qilinadi — R2 orqali yuklangan original_video yozuvlarida Telegram
    tomoni umuman bo'lmaydi. Boshqa file_kind'lar (bot orqali kelgan
    translation/voice/sound_*) hamon services/file_service.py orqali
    ikkalasini ham to'ldirib kelaveradi — bu yerda ularga hech narsa
    o'zgarmaydi, faqat DB darajasidagi majburiylik olib tashlanadi.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("files", sa.Column("r2_key", sa.String(512), nullable=True))
    op.alter_column("files", "telegram_file_id", existing_type=sa.String(512), nullable=True)
    op.alter_column("files", "telegram_message_id", existing_type=sa.BigInteger(), nullable=True)


def downgrade() -> None:
    op.alter_column("files", "telegram_message_id", existing_type=sa.BigInteger(), nullable=False)
    op.alter_column("files", "telegram_file_id", existing_type=sa.String(512), nullable=False)
    op.drop_column("files", "r2_key")
