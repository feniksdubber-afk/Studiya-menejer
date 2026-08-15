from aiogram.fsm.state import State, StatesGroup


class FileSubmission(StatesGroup):
    waiting_file = State()  # state data: {"task_id": str}
