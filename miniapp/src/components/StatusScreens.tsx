export function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-tg-bg text-tg-text">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-tg-hint border-t-tg-button" />
      <p className="text-sm text-tg-hint">Yuklanmoqda...</p>
    </div>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-tg-bg p-6 text-center text-tg-text">
      <p className="text-2xl">⚠️</p>
      <p className="text-sm text-tg-hint">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-xl bg-tg-button px-5 py-2.5 text-sm font-medium text-tg-buttonText"
      >
        Qayta urinish
      </button>
    </div>
  );
}

export function UnregisteredScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-tg-bg p-6 text-center text-tg-text">
      <p className="text-3xl">🤖</p>
      <p className="text-base font-medium">Ro'yxatdan to'liq o'tilmagan</p>
      <p className="text-sm text-tg-hint">
        Davom etish uchun avval Telegram bot orqali ro'yxatdan o'ting (rol tanlang).
      </p>
    </div>
  );
}
