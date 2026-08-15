import type { LucideIcon } from "lucide-react";

// Ilova bo'ylab bir xil "hozircha bo'sh" ko'rinishi uchun umumiy komponent —
// avval faqat CharacterDetailPage'dagi aktyorlar bo'limida bo'lgan
// ikonka+karta uslubi, endi barcha ro'yxatlarda (sezonlar, personajlar,
// jamoa, vazifalar, bildirishnomalar) qo'llaniladi. Buning o'rniga yalang'och
// <p> matni ishlatish sahifani "yarim tayyor" his qildiradi.
export function EmptyState({
  icon: Icon,
  message,
  className = "",
}: {
  icon: LucideIcon;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl bg-tg-secondaryBg px-4 py-8 text-center ${className}`}
    >
      <Icon size={22} className="text-tg-hint" aria-hidden="true" />
      <p className="text-sm text-tg-hint">{message}</p>
    </div>
  );
}
