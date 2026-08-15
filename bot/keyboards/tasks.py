from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

TASK_TYPE_LABELS = {
    "translation": "📝 Tarjima",
    "voice": "🎙️ Ovoz",
    "sound_video": "🎬 Svedeniye (video)",
    "sound_audio": "🎧 Svedeniye (audio)",
}

TASK_STATUS_LABELS = {
    "pending": "📋 Kutilmoqda",
    "submitted": "📤 Topshirilgan",
    "revision_requested": "🔄 Qayta ishlash",
    "accepted": "✅ Qabul qilingan",
    "delayed": "🔴 Kechikkan",
}


def submittable_tasks_keyboard(tasks: list) -> InlineKeyboardMarkup:
    rows = []
    for task in tasks:
        label = f"{TASK_TYPE_LABELS.get(task.task_type.value, task.task_type.value)} — {TASK_STATUS_LABELS.get(task.status.value, task.status.value)}"
        rows.append([InlineKeyboardButton(text=label, callback_data=f"submit_task:{task.id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def submission_start_keyboard(task_id) -> InlineKeyboardMarkup:
    """Task tayinlash/qayta ishlash notification'lariga qo'shiladigan tugma."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📤 Fayl yuborish", callback_data=f"submit_task:{task_id}")]
        ]
    )
