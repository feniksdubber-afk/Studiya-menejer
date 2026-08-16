from aiogram.fsm.state import State, StatesGroup


class Registration(StatesGroup):
    name = State()
    surname = State()
    phone = State()
    role = State()
