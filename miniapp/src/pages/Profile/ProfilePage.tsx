import { CircleUserRound, Check } from "lucide-react";
import { useAuth } from "@/auth/useAuth";

const ROLE_LABEL: Record<string, string> = {
  director: "Rejissyor",
  translator: "Tarjimon",
  voice_actor: "Ovoz aktyori",
  sound_editor: "Ovoz muharriri",
};

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-tg-text">
        <CircleUserRound size={20} aria-hidden="true" /> Profil
      </h1>

      <div className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-tg-hint">Ism</span>
          <span className="text-tg-text">
            {user.first_name} {user.last_name ?? ""}
          </span>
        </div>
        {user.telegram_username && (
          <div className="flex justify-between">
            <span className="text-tg-hint">Username</span>
            <span className="text-tg-text">@{user.telegram_username}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-tg-hint">Rol</span>
          <span className="text-tg-text">{user.role ? ROLE_LABEL[user.role] : "—"}</span>
        </div>
        {user.is_admin && (
          <div className="flex justify-between">
            <span className="text-tg-hint">Admin</span>
            <Check size={16} className="text-role-sound-600" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
