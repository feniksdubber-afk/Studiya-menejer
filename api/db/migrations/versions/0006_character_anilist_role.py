"""characters.anilist_role

AniList har bir personaj uchun uning ahamiyat darajasini qaytaradi:
MAIN (bosh personaj), SUPPORTING (ikkinchi darajali), yoki BACKGROUND
(fon personaji). Hozirgacha bu ma'lumot backend'da olinar edi
(services/anilist.py), lekin hech qayerda saqlanmas edi — import
qilingandan keyin butunlay yo'qolib ketardi. Bu ustun uni doimiy
saqlaydi, shunda frontend keyinchalik ham "bosh personajmi yoki
ikkinchi darajalimi" degan savolga javob bera oladi (faqat import
paytida emas).

Qo'lda (AniList'siz) qo'shilgan personajlar uchun NULL qoladi — ular
uchun bu tushuncha ma'noga ega emas.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

character_anilist_role = sa.Enum(
    "main", "supporting", "background", name="character_anilist_role"
)


def upgrade() -> None:
    character_anilist_role.create(op.get_bind())
    op.add_column(
        "characters",
        sa.Column("anilist_role", character_anilist_role, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("characters", "anilist_role")
    character_anilist_role.drop(op.get_bind())
