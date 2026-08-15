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
      <h1 className="text-lg font-semibold text-tg-text">👤 Profil</h1>

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
            <span className="text-tg-text">✅</span>
          </div>
        )}
      </div>
    </div>
  );
}
