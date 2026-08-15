import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import WebApp from "@twa-dev/sdk";

// Telegram Mini App'ning tabiiy chap-yuqori "orqaga" tugmasini ichki
// sahifalarda yoqadi. Root sahifalarda (BottomNav bilan bosh navigatsiya)
// chaqirilmasligi kerak — u yerda tugma Telegram'ning o'zini yopadi.
export function useTelegramBackButton(fallbackPath = "/") {
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallbackPath);
      }
    };

    WebApp.BackButton.show();
    WebApp.BackButton.onClick(handleClick);

    return () => {
      WebApp.BackButton.offClick(handleClick);
      WebApp.BackButton.hide();
    };
  }, [navigate, fallbackPath]);
}
