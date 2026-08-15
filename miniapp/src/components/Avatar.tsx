// Foydalanuvchi rasmi bo'lmagani uchun (Telegram profil rasmini olish
// alohida ruxsat/oqim talab qiladi), ism harflaridan barqaror rangli
// "initials" avatar yasaymiz — har bir user doim bir xil rangda ko'rinadi.

const PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function initialsOf(firstName: string, lastName?: string | null): string {
  const a = firstName.trim().charAt(0) ?? "";
  const b = (lastName ?? "").trim().charAt(0) ?? "";
  return (a + b || "?").toUpperCase();
}

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function Avatar({
  firstName,
  lastName,
  size = "md",
}: {
  firstName: string;
  lastName?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const seed = `${firstName}${lastName ?? ""}`;
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASS[size]} ${colorFor(seed)}`}
    >
      {initialsOf(firstName, lastName)}
    </div>
  );
}
