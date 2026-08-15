import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
  return (
    // Yuqori xavfsiz zona shu yerda markazlashtirilgan holda hisobga
    // olinadi (notch/status bar) — har bir sahifa alohida qayta yozmasin.
    <div
      className="min-h-screen bg-tg-bg text-tg-text"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Outlet />
      <BottomNav />
    </div>
  );
}
