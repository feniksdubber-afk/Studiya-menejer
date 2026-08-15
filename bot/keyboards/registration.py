from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

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


def director_approval_keyboard(user_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"dir_approve:{user_id}"),
                InlineKeyboardButton(text="❌ Rad etish", callback_data=f"dir_reject:{user_id}"),
            ]
        ]
    )
