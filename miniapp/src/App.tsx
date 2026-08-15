import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { useAuth } from "@/auth/useAuth";
import { LoadingScreen, ErrorScreen, UnregisteredScreen } from "@/components/StatusScreens";

export default function App() {
  const { status, errorMessage, retry } = useAuth();

  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen message={errorMessage ?? "Xatolik"} onRetry={retry} />;
  if (status === "unregistered") return <UnregisteredScreen />;

  return <RouterProvider router={router} />;
}
