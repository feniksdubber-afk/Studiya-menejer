"""Personaj rasmi yuklashda xavfsiz validatsiya + WebP konvertatsiya.

MUHIM: hech qachon fayl extension'iga yoki brauzer yuborgan Content-Type'ga
ishonilmaydi — Pillow orqali fayl decode qilib, HAQIQIY format tekshiriladi.
Original fayl hech qachon diskka yoki R2'ga saqlanmaydi, faqat qayta
kodlangan WebP versiyasi.
"""
import io

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

_ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
_MAX_DIMENSION = 2048  # bundan kattasi shu o'lchamga proporsional kichraytiriladi
_WEBP_QUALITY = 85


class ImageValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def validate_and_convert_to_webp(raw: bytes, max_bytes: int) -> bytes:
    if len(raw) == 0:
        raise ImageValidationError("Bo'sh fayl")
    if len(raw) > max_bytes:
        raise ImageValidationError(f"Fayl hajmi {max_bytes // (1024 * 1024)} MB dan katta bo'lmasligi kerak")

    # 1-bosqich: haqiqiy formatni tekshirish (extension/Content-Type emas).
    # verify() faylni "buzadi" — shuning uchun keyingi qayta ishlash uchun
    # bufferni qaytadan ochamiz.
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()
        detected_format = probe.format
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("Fayl haqiqiy rasm emas yoki buzilgan") from exc

    if detected_format not in _ALLOWED_FORMATS:
        raise ImageValidationError(
            f"Ruxsat etilmagan format: {detected_format}. Faqat JPEG, PNG, WebP qabul qilinadi"
        )

    # 2-bosqich: xavfsiz qayta ishlash — decode -> re-encode. Bu zararli
    # metadata/polyglot fayllardan himoya qiladi (faqat piksel ma'lumoti
    # qayta chizib chiqiladi, boshqa hech narsa saqlanmaydi -> EXIF avtomatik yo'qoladi).
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("Rasmni qayta ishlashda xatolik") from exc

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

    if max(image.size) > _MAX_DIMENSION:
        image.thumbnail((_MAX_DIMENSION, _MAX_DIMENSION), Image.LANCZOS)

    output = io.BytesIO()
    image.save(output, format="WEBP", quality=_WEBP_QUALITY, method=6)
    return output.getvalue()
