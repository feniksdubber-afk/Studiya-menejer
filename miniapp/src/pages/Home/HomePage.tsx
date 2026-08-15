import { useNavigate } from "react-router-dom";
import { ClipboardList, Clapperboard, CircleUserRound } from "lucide-react";
import { useAuth } from "@/auth/useAuth";

const BUTTONS = [
  { to: "/tasks", label: "Mening vazifalarim", icon: ClipboardList },
  { to: "/projects", label: "Loyihalar", icon: Clapperboard },
  { to: "/profile", label: "Profil", icon: CircleUserRound },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
            <btn.icon size={20} className="text-tg-button" aria-hidden="true" />
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
