import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { getTask, setTaskStatus } from "@/api/tasks";
import { getPublicConfig } from "@/api/config";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { useAuth } from "@/auth/useAuth";

const TASK_TYPE_LABEL: Record<string, string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
  });

  // bot_username frontendga qattiq yozilmagan — /config'dan olinadi, shu
  // tufayli username o'zgarsa faqat backend .env yangilanadi, frontend
  // qayta build qilinmasa ham ishlayveradi.
  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: getPublicConfig,
    staleTime: Infinity,
  });

  const acceptMutation = useMutation({
    mutationFn: () => setTaskStatus(taskId!, "accepted"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
  });

  if (isLoading || !task) {
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  }

  const isAssignee = task.assigned_to === user?.id;
  const canAccept = (user?.is_admin || user?.is_super_admin) && task.status === "submitted";

  function openSubmissionInBot() {
    if (!config?.bot_username || !task) return;
    // Bot /start task_<id> ni oladi -> u yerda to'liq avtorizatsiya zanjiri
    // qayta tekshiriladi (bot task_id'ning o'zini yetarli deb hisoblamaydi).
    const link = `https://t.me/${config.bot_username}?start=task_${task.id}`;
    WebApp.openTelegramLink(link);
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-tg-text">
          {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
        </h1>
        <TaskStatusBadge status={task.status} />
      </div>

      <dl className="flex flex-col gap-2 rounded-2xl bg-tg-secondaryBg p-4 text-sm">
        {task.deadline && (
          <div className="flex justify-between">
            <dt className="text-tg-hint">Deadline</dt>
            <dd className="text-tg-text">{new Date(task.deadline).toLocaleString("uz-UZ")}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-tg-hint">Versiya</dt>
          <dd className="text-tg-text">v{task.current_version}</dd>
        </div>
      </dl>

      {task.status === "revision_requested" && task.revision_reason && (
        <div className="rounded-2xl bg-orange-50 p-4 text-sm text-orange-800">
          <p className="font-medium">Qayta topshirish sababi:</p>
          <p className="mt-1">{task.revision_reason}</p>
        </div>
      )}

      {isAssignee && (task.status === "pending" || task.status === "revision_requested") && (
        <button
          onClick={openSubmissionInBot}
          disabled={!config?.bot_username}
          className="rounded-xl bg-tg-button px-4 py-3 text-sm font-medium text-tg-buttonText disabled:opacity-50"
        >
          📤 Fayl topshirish
        </button>
      )}

      {canAccept && (
        <button
          onClick={() => acceptMutation.mutate()}
          disabled={acceptMutation.isPending}
          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          ✅ Qabul qilish
        </button>
      )}
    </div>
  );
}
