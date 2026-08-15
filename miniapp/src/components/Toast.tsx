import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  variant: "success" | "error";
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Bildirishnomalar uchun tashqi kutubxonasiz yengil yechim — Telegram Mini App
// muhitida qo'shimcha bog'liqlik kerak emas, mavjud stack (Tailwind + lucide)
// bilan yetarli.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastItem["variant"]) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => remove(id), 3000);
    },
    [remove]
  );

  const showSuccess = useCallback((message: string) => push(message, "success"), [push]);
  const showError = useCallback((message: string) => push(message, "error"), [push]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-[92%] items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium shadow-lg backdrop-blur ${
              t.variant === "success"
                ? "bg-role-sound-800 text-white"
                : "bg-role-voice-800 text-white"
            }`}
          >
            {t.variant === "success" ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <XCircle size={16} aria-hidden="true" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast ToastProvider ichida ishlatilishi kerak");
  }
  return ctx;
}
