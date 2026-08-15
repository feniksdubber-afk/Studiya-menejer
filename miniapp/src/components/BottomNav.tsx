import { NavLink } from "react-router-dom";

const items = [
  { to: "/tasks", label: "Vazifalarim", icon: "📋" },
  { to: "/projects", label: "Loyihalar", icon: "🎬" },
  { to: "/profile", label: "Profil", icon: "👤" },
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
          <span className="text-lg leading-none">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
