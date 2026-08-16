"""Foydalanuvchiga ko'rsatiladigan vaqtlarni mahalliy (Toshkent) vaqt zonasiga
o'girish uchun umumiy yordamchi funksiyalar.

DB'da barcha datetime'lar UTC (tz-aware) holda saqlanadi (bot/main.py'dagi
scheduler ham timezone="UTC" bilan ishlaydi). Foydalanuvchiga Telegram xabarida
ko'rsatilayotganda esa MiniApp bilan bir xil natija berish uchun (u brauzer
mahalliy vaqtidan foydalanadi, odatda Asia/Tashkent) shu vaqt zonasiga
o'girish shart — aks holda bot va MiniApp'dagi vaqtlar orasida farq (UTC+5)
paydo bo'ladi.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

TASHKENT_TZ = ZoneInfo("Asia/Tashkent")


def to_local(dt: datetime | None) -> datetime | None:
    """Berilgan (odatda UTC, tz-aware) datetime'ni Toshkent vaqtiga o'giradi.

    Agar dt naive (tzinfo yo'q) bo'lsa, u UTC deb qabul qilinadi — chunki
    loyihadagi barcha DB ustunlari timezone=True bilan e'lon qilingan va
    server tomonidan doim datetime.now(timezone.utc) yoziladi.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        from datetime import timezone as _tz

        dt = dt.replace(tzinfo=_tz.utc)
    return dt.astimezone(TASHKENT_TZ)


def format_dt(dt: datetime | None, fmt: str = "%d-%m %H:%M", default: str = "-") -> str:
    """Vaqtni Toshkent vaqt zonasida berilgan formatda qaytaradi."""
    local_dt = to_local(dt)
    if local_dt is None:
        return default
    return local_dt.strftime(fmt)
