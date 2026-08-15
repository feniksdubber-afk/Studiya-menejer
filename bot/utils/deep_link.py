"""Telegram deep-link payload'larini tahlil qilish.

t.me/<bot>?start=task_<uuid> formatidagi havolalar shu yerda tekshiriladi.
Faqat formatni tekshiradi — HAQIQIY avtorizatsiya (task egasi ekanligi,
holati va h.k.) handlers/file_submit.py'dagi start_task_submission_flow'da
amalga oshiriladi. Bu yerda faqat "task_" prefiksli va bo'sh bo'lmagan
qoldiq borligini tekshiramiz.
"""

_TASK_PREFIX = "task_"


def parse_task_deep_link_payload(raw_payload: str | None) -> str | None:
    if not raw_payload:
        return None
    if not raw_payload.startswith(_TASK_PREFIX):
        return None
    task_id = raw_payload[len(_TASK_PREFIX):]
    return task_id or None
