from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://user:pass@localhost:5432/afsona_dub"

    bot_token: str  # Telegram bot token — initData HMAC va Bot API uchun ham ishlatiladi

    # Frontendga qattiq yozib qo'yilmaydi — GET /config orqali ochiq beriladi,
    # Mini App shundan deep-link (t.me/<username>?start=task_<id>) quradi.
    bot_username: str = ""

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7  # 7 kun

    # Bot -> API ichki chaqiruvlari uchun umumiy sir (masalan POST /internal/files).
    # Bu endpointlar foydalanuvchi JWT bilan emas, shu kalit bilan himoyalanadi,
    # aks holda tashqaridan soxta telegram_file_id yuborib taskni submitted
    # qilib qo'yish mumkin bo'lardi.
    internal_api_key: str

    # initData qancha vaqt "yangi" hisoblanadi (Telegram tavsiyasi: 24 soat)
    init_data_max_age_seconds: int = 60 * 60 * 24

    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_base_url: str = ""

    character_image_max_bytes: int = 5 * 1024 * 1024  # 5 MB
    voice_cue_screenshot_max_bytes: int = 5 * 1024 * 1024  # 5 MB — video kadr skrinshoti

    # --- V1: original video R2 storage (VOICE-CUES-PLAN.md) ---
    video_max_bytes: int = 500 * 1024 * 1024  # 500 MB — presigned upload-url va confirm ikkalasida ham tekshiriladi
    video_upload_url_expires_seconds: int = 60 * 15  # 15 daqiqa — brauzer shu vaqt ichida R2'ga yuklashi kerak
    video_playback_url_expires_seconds: int = 60 * 60  # 1 soat — <video src> uchun vaqtinchalik o'qish havolasi


settings = Settings()
