import { AlertTriangle, Bot } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col gap-3 bg-tg-bg p-5 pt-8">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-tg-secondaryBg" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
        <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
        <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
      </div>
    </div>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-tg-bg p-6 text-center text-tg-text">
      <AlertTriangle size={32} className="text-role-voice-600" aria-hidden="true" />
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
      <Bot size={32} className="text-tg-hint" aria-hidden="true" />
      <p className="text-base font-medium">Ro'yxatdan to'liq o'tilmagan</p>
      <p className="text-sm text-tg-hint">
        Davom etish uchun avval Telegram bot orqali ro'yxatdan o'ting (rol tanlang).
      </p>
    </div>
  );
}
