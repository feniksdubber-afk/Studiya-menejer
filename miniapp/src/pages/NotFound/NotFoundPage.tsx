import { useNavigate } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-tg-bg p-6 text-center text-tg-text">
      <FileQuestion size={32} className="text-tg-hint" aria-hidden="true" />
      <p className="text-base font-medium">Sahifa topilmadi</p>
      <button
        onClick={() => navigate("/")}
        className="rounded-xl bg-tg-button px-5 py-2.5 text-sm font-medium text-tg-buttonText"
      >
        Bosh sahifaga qaytish
      </button>
    </div>
  );
}
