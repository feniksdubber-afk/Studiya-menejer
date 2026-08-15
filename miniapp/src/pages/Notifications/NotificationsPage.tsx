import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications";
import { QueryError } from "@/components/StatusScreens";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import {
  BellRing,
  ClipboardCheck,
  Inbox,
  RotateCcw,
  AlertTriangle,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import type { Notification, NotificationType } from "@/types";

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  task_assigned: { label: "Yangi vazifa biriktirildi", icon: ClipboardCheck },
  task_submitted: { label: "Fayl topshirildi", icon: Inbox },
  task_revision_requested: { label: "Qayta ishlashga qaytarildi", icon: RotateCcw },
  task_delayed: { label: "Deadline o'tib ketdi", icon: AlertTriangle },
  deadline_soon: { label: "Deadline yaqinlashmoqda", icon: Clock3 },
};

function metaFor(type: NotificationType) {
  return TYPE_META[type] ?? { label: type, icon: BellRing };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hozir";
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
}

// Ba'zi bildirishnoma turlari task_id bilan keladi -- bosilganda to'g'ridan
// -to'g'ri o'sha vazifaga o'tkazamiz. Boshqa turlar uchun hozircha faqat
// o'qilgan deb belgilanadi.
function targetPath(n: Notification): string | null {
  const taskId = n.payload?.["task_id"];
  if (typeof taskId === "string") return `/tasks/${taskId}`;
  return null;
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (n: Notification) => void;
}) {
  const meta = metaFor(notification.type);
  return (
    <button
      onClick={() => onOpen(notification)}
      className={`flex items-start gap-3 rounded-2xl p-3.5 text-left transition-colors ${
        notification.is_read ? "bg-tg-secondaryBg" : "bg-tg-button/10"
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          notification.is_read ? "bg-tg-bg text-tg-hint" : "bg-tg-button/20 text-tg-button"
        }`}
      >
        <meta.icon size={16} aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-tg-text">{meta.label}</span>
        <span className="text-xs text-tg-hint">{timeAgo(notification.created_at)}</span>
      </div>
      {!notification.is_read && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-tg-button" aria-hidden="true" />
      )}
    </button>
  );
}

export default function NotificationsPage() {
  useTelegramBackButton("/profile");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
  });

  const { mutate: openNotification } = useMutation({
    mutationFn: (n: Notification) => markNotificationRead(n.id),
    onMutate: async (n) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      queryClient.setQueryData<Notification[]>(["notifications"], (old) =>
        old?.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const { mutate: markAllRead, isPending: isMarkingAll } = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      WebApp.HapticFeedback.notificationOccurred("success");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  function handleOpen(n: Notification) {
    WebApp.HapticFeedback.impactOccurred("light");
    if (!n.is_read) openNotification(n);
    const path = targetPath(n);
    if (path) navigate(path);
  }

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  if (isLoading) {
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  }
  if (isError) {
    return (
      <div className="p-5">
        <QueryError message="Bildirishnomalarni yuklab bo'lmadi." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-tg-text">Bildirishnomalar</h1>
        {hasUnread && (
          <button
            onClick={() => markAllRead()}
            disabled={isMarkingAll}
            className="text-xs font-medium text-tg-button disabled:opacity-50"
          >
            {isMarkingAll ? "..." : "Hammasini o'qilgan qilish"}
          </button>
        )}
      </div>

      {!notifications || notifications.length === 0 ? (
        <p className="text-sm text-tg-hint">Hozircha bildirishnomalar yo'q.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
