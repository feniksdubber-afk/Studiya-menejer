import os

BOT_TOKEN = os.environ["BOT_TOKEN"]
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://user:pass@localhost:5432/afsona_dub"
)

# Deep-link va h.k. uchun (masalan loglarda). Frontend BOT_USERNAME'ni
# botdan emas, API'ning GET /config endpointidan oladi — shu tufayli
# username o'zgarsa faqat shu yerda va API .env'da yangilash kifoya.
BOT_USERNAME = os.environ.get("BOT_USERNAME", "")

# FastAPI server manzili va ichki so'rovlar uchun umumiy sir. Bot fayl
# topshirishda binary'ni emas, faqat file_id/metadata'ni shu orqali
# /internal/files ga yuboradi (api/core/config.py'dagi internal_api_key
# bilan bir xil bo'lishi shart).
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
INTERNAL_API_KEY = os.environ["INTERNAL_API_KEY"]
