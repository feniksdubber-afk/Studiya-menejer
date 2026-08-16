"""Cloudflare R2 — personaj rasmlari (WebP) va V1'dan boshlab original video
(dub-videos/) uchun. Boshqa fayllar (translation/voice/sound_*) hamon
Telegram file_id orqali saqlanadi (services/file_service.py).
"""
import uuid

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from core.config import settings

_CONTENT_TYPE = "image/webp"


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto",
    )


def build_object_key(prefix: str = "dub-characters") -> str:
    """Har doim yangi tasodifiy nom — eski/yangi rasm kaliti hech qachon
    ustma-ust tushmaydi (keshlash muammolarining oldini oladi).

    Prefix: bu R2 bucket AfsonaMovieBot bilan bo'lishilgan (afsona-videos),
    shu sababli AFSONA DUB o'z obyektlarini alohida prefix ostida saqlaydi —
    ikkala loyiha fayllari bir-biriga aralashmasligi uchun. Default qiymat
    ("dub-characters") personaj rasmlari uchun eski xatti-harakatni saqlab
    qoladi; VoiceCue skrinshotlari `prefix="dub-cues"` bilan chaqiradi.
    """
    return f"{prefix}/{uuid.uuid4()}.webp"


def upload_webp(key: str, data: bytes) -> None:
    _client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=_CONTENT_TYPE,
        CacheControl="public, max-age=31536000, immutable",
    )


def delete_object(key: str) -> None:
    if not key:
        return
    try:
        _client().delete_object(Bucket=settings.r2_bucket_name, Key=key)
    except ClientError:
        # O'chirilayotgan obyekt allaqachon yo'q bo'lsa ham DB tozalanishi
        # kerak — bu yerda xatoni yutib, chaqiruvchini bloklamaymiz.
        pass


def object_exists(key: str) -> bool:
    try:
        _client().head_object(Bucket=settings.r2_bucket_name, Key=key)
        return True
    except ClientError:
        return False


def public_url(key: str) -> str | None:
    if not key:
        return None
    base = settings.r2_public_base_url.rstrip("/")
    if not base:
        return None
    return f"{base}/{key}"


# ==================== VIDEO (V1: presigned upload/playback) ====================
# Personaj rasmlaridan farqli o'laroq video ochiq (public) URL orqali emas,
# har doim VAQTINCHALIK imzolangan havola orqali ko'rsatiladi — bucket'da
# original video ommaviy o'qishga ochiq emas (§V1).

def build_video_object_key(original_filename: str) -> str:
    """dub-videos/<uuid>.<ext> — kengaytma original nomdan olinadi (frontend
    <video> content-type'ni to'g'ri aniqlashi uchun), lekin fayl nomining
    o'zi hech qachon kalitga qo'shilmaydi (xavfsizlik/keshlash)."""
    ext = ""
    if "." in original_filename:
        ext = "." + original_filename.rsplit(".", 1)[-1].lower()[:10]
    return f"dub-videos/{uuid.uuid4()}{ext}"


def generate_presigned_upload_url(key: str, content_type: str, expires_in: int) -> str:
    """Brauzer shu URL'ga to'g'ridan-to'g'ri PUT qiladi — katta video API
    serveri orqali proksi qilinmaydi (§V1: xavfsiz va tez emas)."""
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def generate_presigned_download_url(key: str, expires_in: int) -> str:
    """`GET /episodes/{id}/original-video` shu havolani qaytaradi, frontend
    to'g'ridan-to'g'ri `<video src=...>`ga beradi."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )


def get_object_size(key: str) -> int | None:
    """Haqiqiy fayl hajmini R2'dan so'rab tasdiqlaydi — `confirm`
    endpointida faqat frontend tekshiruviga ishonib bo'lmaydi (§V1)."""
    try:
        head = _client().head_object(Bucket=settings.r2_bucket_name, Key=key)
        return head.get("ContentLength")
    except ClientError:
        return None
