import { createContext, useEffect, useState, type ReactNode } from "react";
import WebApp from "@twa-dev/sdk";
import { authWithTelegram } from "@/api/auth";
import {
  clearStoredToken,
  getStoredToken,
  registerUnauthorizedHandler,
  setStoredToken,
} from "@/api/client";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "error" | "unregistered";
  errorMessage: string | null;
  retry: () => void;
  /** Serverdan yangilangan user obyektini local state'ga yozadi — masalan,
   * Profil sahifasida rolni almashtirgandan keyin to'liq qayta autentifikatsiya
   * qilmasdan UI'ni darhol yangilash uchun. */
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      setStatus("loading");
      setErrorMessage(null);

      // MUHIM: frontend Telegram.WebApp.initDataUnsafe'ga hech qachon
      // ishonmaydi (u client tomonidan o'zgartirilishi mumkin). Faqat xom
      // initData satri backendga yuboriladi — HMAC tekshiruvi serverda
      // bo'ladi (core/security.py: verify_init_data).
      const initData = WebApp.initData;

      if (!initData) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(
            "Telegram initData topilmadi. Mini App faqat Telegram ichida ochilganda ishlaydi."
          );
        }
        return;
      }

      try {
        const result = await authWithTelegram(initData);
        if (cancelled) return;

        setStoredToken(result.access_token);
        setUser(result.user);

        // role=null bo'lsa — foydalanuvchi hali bot orqali to'liq
        // ro'yxatdan o'tmagan (backend: require_registered_user shu holatda bloklaydi).
        if (!result.user.role) {
          setStatus("unregistered");
        } else {
          setStatus("authenticated");
        }
      } catch (err) {
        if (cancelled) return;
        clearStoredToken();
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Autentifikatsiya muvaffaqiyatsiz tugadi"
        );
      }
    }

    void authenticate();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    // /auth/telegram'dan tashqari har qanday so'rov 401 qaytarsa
    // (token muddati tugagan bo'lishi mumkin), sessiyani qayta tiklaymiz.
    registerUnauthorizedHandler(() => {
      setUser(null);
      setAttempt((n) => n + 1);
    });
  }, []);

  // Ilova ochilganda saqlangan token bo'lsa ham, initData orqali qayta
  // tekshiruv baribir amalga oshiriladi (yuqoridagi effect) — bu shunchaki
  // "flash of unauthenticated" ni oldini olish uchun emas, chunki initData
  // tekshiruvi tez.
  void getStoredToken();

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        errorMessage,
        retry: () => setAttempt((n) => n + 1),
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
