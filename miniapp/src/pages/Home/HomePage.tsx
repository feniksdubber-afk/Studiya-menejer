import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clapperboard, Bell, CircleUserRound } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { getUnreadNotificationCount } from "@/api/notifications";

const BUTTONS = [
  { to: "/tasks", label: "Mening vazifalarim", icon: ClipboardList },
  { to: "/projects", label: "Loyihalar", icon: Clapperboard },
  { to: "/notifications", label: "Bildirishnoma", icon: Bell },
  { to: "/profile", label: "Profil", icon: CircleUserRound },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-6 p-5 pt-8 pb-20">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-tg-text">AFSONA DUB</h1>
        <p className="mt-1 text-sm text-tg-hint">Salom, {user?.first_name}</p>
      </div>

      <div className="flex flex-col gap-3">
        {BUTTONS.map((btn) => (
          <button
            key={btn.to}
            onClick={() => navigate(btn.to)}
            className="flex items-center gap-3 rounded-2xl bg-tg-secondaryBg px-4 py-4 text-left text-base font-medium text-tg-text active:opacity-70"
          >
            <span className="relative">
              <btn.icon size={20} className="text-tg-button" aria-hidden="true" />
              {btn.to === "/notifications" && !!unreadCount && (
                <span
                  className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-role-voice-800 px-0.5 text-[9px] font-semibold leading-none text-white"
                  aria-label={`${unreadCount} ta o'qilmagan bildirishnoma`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
