import axios, { type AxiosError } from "axios";

// Prod'da Caddy /api/* ni FastAPI'ga proxy qiladi (deploy/Caddyfile).
// Dev'da vite.config.ts shu prefixni backendga proxy qiladi.
// Standart timeout — osilib qolgan so'rovlar foydalanuvchini abadiy
// "Yuklanmoqda..." holatida ushlab turmasligi uchun. Uzoqroq davom
// etadigan alohida so'rovlar (masalan AniList personajlarini import
// qilish) buni request config'da o'zi override qiladi.
export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 20_000,
});

const TOKEN_STORAGE_KEY = "afsona_dub_jwt";

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 kelsa — token yaroqsiz/muddati o'tgan. Tokenni tozalaymiz;
// AuthProvider buni ushlab qayta /auth/telegram orqali sessiyani tiklaydi.
export type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearStoredToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);
