import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WebApp from "@twa-dev/sdk";
import App from "./App";
import { AuthProvider } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import "./index.css";

WebApp.ready();
WebApp.expand();

// Pastga tortib ilovani tasodifan yopib qo'yishning oldini olamiz —
// forma ichida (masalan qayta ishlashga qaytarish sababi) ma'lumot
// yo'qolib ketmasligi uchun. Metod @twa-dev/sdk'ning ba'zi versiyalarida
// tip ta'rifida yo'q bo'lishi mumkin, shuning uchun ehtiyotkorlik bilan
// (runtime mavjudligini tekshirib) chaqiramiz.
(WebApp as unknown as { disableVerticalSwipes?: () => void }).disableVerticalSwipes?.();

// Telegram header/fon rangini joriy tema o'zgaruvchilariga moslaymiz va
// tema (light/dark) almashganda <html>ga "dark" klassini qo'yib turamiz —
// Tailwind'ning dark: variantlari (rol ranglari) shu orqali ishlaydi.
function syncTelegramTheme() {
  WebApp.setHeaderColor("secondary_bg_color");
  WebApp.setBackgroundColor(WebApp.themeParams.bg_color ?? "#ffffff");
  document.documentElement.classList.toggle("dark", WebApp.colorScheme === "dark");
}
syncTelegramTheme();
WebApp.onEvent("themeChanged", syncTelegramTheme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
