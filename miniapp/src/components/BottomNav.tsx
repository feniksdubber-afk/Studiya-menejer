import { NavLink } from "react-router-dom";
import { ClipboardList, Clapperboard, CircleUserRound } from "lucide-react";

const items = [
  { to: "/tasks", label: "Vazifalarim", icon: ClipboardList },
  { to: "/projects", label: "Loyihalar", icon: Clapperboard },
  { to: "/profile", label: "Profil", icon: CircleUserRound },
];

export function BottomNav() {
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
              <item.icon size={20} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
