import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleUserRound, Check, ShieldCheck, Clock, XCircle } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { Avatar } from "@/components/Avatar";
import { updateMyRole } from "@/api/users";
import { useToast } from "@/components/Toast";
import type { UserRole } from "@/types";

// Bot orqali dastlabki registratsiyadagi labellar bilan bir xil
// (qarang: bot/keyboards/registration.py — ROLE_LABELS).
const ROLE_LABEL: Record<UserRole, string> = {
  director: "🎬 Rejissyor",
  translator: "📝 Tarjimon",
  voice_actor: "🎙️ Ovoz aktyori",
  sound_editor: "🎧 Svedeniyachi",
};

const ROLE_ORDER: UserRole[] = ["director", "translator", "voice_actor", "sound_editor"];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => updateMyRole(role),
    onSuccess: (updated, role) => {
      updateUser(updated);
      setPickerOpen(false);
      if (role === "director") {
        showSuccess("Rejissyorlik so'rovi yuborildi — admin tasdig'i kutilmoqda");
      } else {
        showSuccess("Rolingiz yangilandi");
      }
    },
    onError: () => showError("Rolni almashtirib bo'lmadi"),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-tg-text">
        <CircleUserRound size={20} aria-hidden="true" /> Profil
      </h1>

      <div className="flex items-center gap-3 rounded-2xl bg-tg-secondaryBg p-4">
        <Avatar firstName={user.first_name} lastName={user.last_name} size="lg" />
        <div className="flex flex-col">
          <span className="text-base font-semibold text-tg-text">
            {user.first_name} {user.last_name ?? ""}
          </span>
          {user.telegram_username && (
            <span className="text-sm text-tg-hint">@{user.telegram_username}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-tg-hint">Rol</span>
          <span className="text-tg-text">
            {user.role ? ROLE_LABEL[user.role] : "—"}
          </span>
        </div>

        {/* Rejissyorlik so'rovi holati — faqat director tanlangan bo'lsa
            va hali "none" bo'lmasa ko'rsatiladi. */}
        {user.role === "director" && user.director_status === "pending" && (
          <div className="flex items-center gap-1.5 rounded-xl bg-role-director-50 px-2.5 py-1.5 text-xs text-role-director-800">
            <Clock size={13} aria-hidden="true" /> Admin tasdig'i kutilmoqda
          </div>
        )}
        {user.role === "director" && user.director_status === "rejected" && (
          <div className="flex items-center gap-1.5 rounded-xl bg-role-voice-50 px-2.5 py-1.5 text-xs text-role-voice-600">
            <XCircle size={13} aria-hidden="true" /> So'rov rad etilgan — qayta yuborish uchun
            rolni qayta tanlang
          </div>
        )}

        {user.is_super_admin ? (
          <div className="flex items-center justify-between">
            <span className="text-tg-hint">Super admin</span>
            <ShieldCheck size={16} className="text-role-sound-600" aria-hidden="true" />
          </div>
        ) : (
          user.is_admin && (
            <div className="flex items-center justify-between">
              <span className="text-tg-hint">Admin</span>
              <Check size={16} className="text-role-sound-600" aria-hidden="true" />
            </div>
          )
        )}

        {!pickerOpen ? (
          <button
            onClick={() => setPickerOpen(true)}
            className="mt-1 self-start text-xs font-medium text-tg-link active:opacity-70"
          >
            Rolni o'zgartirish
          </button>
        ) : (
          <div className="mt-1 flex flex-col gap-2">
            <p className="text-xs text-tg-hint">
              Yangi rolni tanlang. Rejissyorlikka o'tish uchun admin tasdig'i kerak bo'ladi.
            </p>
            <div className="flex flex-col gap-1.5">
              {ROLE_ORDER.map((role) => (
                <button
                  key={role}
                  onClick={() => roleMutation.mutate(role)}
                  disabled={roleMutation.isPending || role === user.role}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium disabled:opacity-50 ${
                    role === user.role
                      ? "bg-role-director-600 text-white"
                      : "bg-tg-bg text-tg-text active:opacity-70"
                  }`}
                >
                  {ROLE_LABEL[role]}
                  {role === user.role && <Check size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPickerOpen(false)}
              disabled={roleMutation.isPending}
              className="self-start text-xs font-medium text-tg-hint active:opacity-70"
            >
              Bekor qilish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
