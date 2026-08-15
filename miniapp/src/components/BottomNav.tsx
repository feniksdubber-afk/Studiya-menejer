import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clapperboard, Bell, CircleUserRound } from "lucide-react";
import { getUnreadNotificationCount } from "@/api/notifications";

const items = [
  { to: "/tasks", label: "Vazifalarim", icon: ClipboardList },
  { to: "/projects", label: "Loyihalar", icon: Clapperboard },
  { to: "/notifications", label: "Bildirishnoma", icon: Bell },
  { to: "/profile", label: "Profil", icon: CircleUserRound },
];

export function BottomNav() {
  // 30 soniyada bir marta so'raladi -- push (bot/services/notification_pusher.py)
  // real vaqtli, lekin bu badge shunchaki foydalanuvchi Mini App'ni ochib
  // turgan paytda taxminan yangi qolishi uchun yetarli, ortiqcha yuklamasiz.
  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30_000,
  });

  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-tg-secondaryBg bg-tg-bg pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive ? "text-tg-button" : "text-tg-hint"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <item.icon size={20} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
                {item.to === "/notifications" && !!unreadCount && (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-role-voice-800 px-0.5 text-[9px] font-semibold leading-none text-white"
                    aria-label={`${unreadCount} ta o'qilmagan bildirishnoma`}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
