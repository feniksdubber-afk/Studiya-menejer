from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

ROLE_LABELS = {
    "director": "🎬 Rejissyor",
    "translator": "📝 Tarjimon",
    "voice_actor": "🎙️ Ovoz aktyori",
    "sound_editor": "🎧 Svedeniyachi",
}


def role_selection_keyboard() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=label, callback_data=f"reg_role:{key}")]
        for key, label in ROLE_LABELS.items()
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def contact_request_keyboard() -> ReplyKeyboardMarkup:
    """Foydalanuvchidan faqat Telegram'ning o'z tugmasi orqali (qo'lda
    yozdirmasdan) raqam so'raydi — bu format xatosi va soxta raqam
    kiritish ehtimolini butunlay yo'q qiladi, chunki Telegram bu holatda
    aynan shu akkauntga bog'langan raqamni yuboradi."""
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Raqamni ulashish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def remove_keyboard() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()


def director_approval_keyboard(user_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"dir_approve:{user_id}"),
                InlineKeyboardButton(text="❌ Rad etish", callback_data=f"dir_reject:{user_id}"),
            ]
        ]
    )
