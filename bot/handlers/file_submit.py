import logging
import uuid

from aiogram import F, Router
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select

from db import get_session
from keyboards.tasks import submittable_tasks_keyboard
from models.tasks import Task, TaskStatus
from models.users import User
from services.api_client import InternalApiError, submit_file
from states.file_submission import FileSubmission

router = Router(name="file_submit")
logger = logging.getLogger(__name__)

# Fayl topshirish mumkin bo'lgan holatlar (api/services/file_service.py bilan bir xil)
_SUBMITTABLE_STATUSES = (
    TaskStatus.pending,
    TaskStatus.revision_requested,
    TaskStatus.submitted,
    TaskStatus.delayed,
)


async def _get_user(telegram_id: int) -> User | None:
    async with get_session() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        return result.scalar_one_or_none()


async def start_task_submission_flow(
    message: Message,
    state: FSMContext,
    telegram_id: int,
    task_id_raw: str,
) -> None:
    """Deep-link (`/start task_<id>`) va oddiy `/topshirish` oqimi ikkalasi
    uchun ham ishlatiladigan yagona avtorizatsiya zanjiri. `task_id`ning
    o'zi HECH QACHON yetarli emas — quyidagi 5 bosqich to'liq bajarilmasa,
    FSM `waiting_file`ga o'tkazilmaydi:

      1. Telegram user aniqlanadi (DB'da mavjud/registered).
      2. Task mavjudligi tekshiriladi.
      3. task.assigned_to == shu user ekanligi tekshiriladi.
      4. Task holati topshirish uchun yaroqli ekanligi tekshiriladi
         (jumladan `accepted` bo'lmasligi — _SUBMITTABLE_STATUSES accepted'ni
         allaqachon istisno qiladi).
      5. Shundan keyingina waiting_file FSM holatiga o'tkaziladi.

    Shu tartib tufayli foydalanuvchi boshqa birovning task ID'sini qo'lda
    (yoki soxta deep-link orqali) yozsa ham fayl topshira olmaydi.
    """
    # 1. Foydalanuvchini aniqlash
    user = await _get_user(telegram_id)
    if user is None or not user.is_registered:
        await message.answer("Avval ro'yxatdan o'ting: /start")
        return

    try:
        task_uuid = uuid.UUID(task_id_raw)
    except ValueError:
        await message.answer("❌ Havola noto'g'ri (vazifa ID formati xato).")
        return

    # 2. Task mavjudligi
    async with get_session() as db:
        task = await db.get(Task, task_uuid)
    if task is None:
        await message.answer("❌ Bunday vazifa topilmadi.")
        return

    # 3. Egalik tekshiruvi — boshqa birovning task ID'sini yozib ko'rish shu yerda to'xtaydi
    if task.assigned_to != user.id:
        await message.answer("❌ Bu vazifa sizga tegishli emas.")
        return

    # 4. Holat tekshiruvi (accepted va h.k. — topshirib bo'lmaydi)
    if task.status not in _SUBMITTABLE_STATUSES:
        await message.answer("❌ Bu holatdagi vazifaga fayl topshirib bo'lmaydi.")
        return

    # 5. Faqat shu yerda FSM waiting_file'ga o'tadi
    await state.set_state(FileSubmission.waiting_file)
    await state.update_data(task_id=str(task.id))

    await message.answer(
        "📤 Endi faylni (video/audio/hujjat) shu chatga yuboring.\n"
        "Bekor qilish uchun /bekor_qilish deb yozing."
    )


@router.message(Command("topshirish"))
async def cmd_topshirish(message: Message):
    user = await _get_user(message.from_user.id)
    if user is None or not user.is_registered:
        await message.answer("Avval ro'yxatdan o'ting: /start")
        return

    async with get_session() as db:
        result = await db.execute(
            select(Task).where(
                Task.assigned_to == user.id,
                Task.status.in_(_SUBMITTABLE_STATUSES),
            )
        )
        tasks = list(result.scalars().all())

    if not tasks:
        await message.answer("Hozircha fayl topshirish mumkin bo'lgan vazifangiz yo'q.")
        return

    await message.answer(
        "Qaysi vazifa uchun fayl yubormoqchisiz?",
        reply_markup=submittable_tasks_keyboard(tasks),
    )


@router.callback_query(F.data.startswith("submit_task:"))
async def cb_start_submission(callback: CallbackQuery, state: FSMContext):
    task_id_raw = callback.data.split(":", 1)[1]
    await start_task_submission_flow(callback.message, state, callback.from_user.id, task_id_raw)
    await callback.answer()


@router.message(Command("bekor_qilish"), StateFilter(FileSubmission.waiting_file))
async def cmd_cancel_submission(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Fayl topshirish bekor qilindi.")


@router.message(StateFilter(FileSubmission.waiting_file), F.document | F.video | F.audio | F.voice)
async def handle_submitted_file(message: Message, state: FSMContext):
    data = await state.get_data()
    task_id_raw = data.get("task_id")
    if not task_id_raw:
        await state.clear()
        await message.answer("Sessiya eskirgan, qaytadan /topshirish orqali boshlang.")
        return

    user = await _get_user(message.from_user.id)
    if user is None:
        await state.clear()
        await message.answer("Foydalanuvchi topilmadi.")
        return

    tg_file = message.document or message.video or message.audio or message.voice
    file_name = getattr(tg_file, "file_name", None) or f"{tg_file.file_unique_id}"
    mime_type = getattr(tg_file, "mime_type", None)
    file_size = getattr(tg_file, "file_size", None)

    try:
        result = await submit_file(
            task_id=uuid.UUID(task_id_raw),
            uploaded_by=user.id,
            telegram_file_id=tg_file.file_id,
            telegram_message_id=message.message_id,
            file_name=file_name,
            mime_type=mime_type,
            file_size=file_size,
        )
    except InternalApiError as exc:
        logger.warning("File submission failed: %s", exc.detail)
        await message.answer(f"❌ Fayl qabul qilinmadi: {exc.detail}")
        return
    except Exception:
        logger.exception("Unexpected error during file submission")
        await message.answer("❌ Kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.")
        return

    await state.clear()
    version_number = result.get("task_current_version")
    await message.answer(
        f"✅ Fayl qabul qilindi (v{version_number}). Rejissyorga bildirishnoma yuborildi."
    )


@router.message(StateFilter(FileSubmission.waiting_file))
async def handle_unexpected_content(message: Message):
    await message.answer(
        "Iltimos, fayl (video/audio/hujjat) yuboring yoki /bekor_qilish bilan bekor qiling."
    )
