import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { Upload, CheckCircle2, RotateCcw, History } from "lucide-react";
import { getDeadlineHistory, getTask, requestRevision, setTaskStatus } from "@/api/tasks";
import { getPublicConfig } from "@/api/config";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { DeadlineRing } from "@/components/DeadlineRing";
import { QueryError } from "@/components/StatusScreens";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/useAuth";

const TASK_TYPE_LABEL: Record<string, string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

function RequestRevisionForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();
  const [reason, setReason] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  const { mutate: submit, isPending, error } = useMutation({
    mutationFn: () =>
      requestRevision(
        taskId,
        reason.trim(),
        newDeadline ? new Date(newDeadline).toISOString() : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["deadline-history", taskId] });
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess("Vazifa qayta ishlashga qaytarildi.");
      onDone();
    },
    onError: () => {
      WebApp.HapticFeedback.notificationOccurred("error");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    submit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl bg-tg-secondaryBg p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="revision-reason" className="text-xs font-medium text-tg-hint">
          Qaytarish sababi
        </label>
        <textarea
          id="revision-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Nima to'g'irlanishi kerak?"
          rows={3}
          autoFocus
          className="resize-none rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="revision-deadline" className="text-xs font-medium text-tg-hint">
          Yangi deadline (ixtiyoriy)
        </label>
        <input
          id="revision-deadline"
          type="datetime-local"
          value={newDeadline}
          onChange={(e) => setNewDeadline(e.target.value)}
          className="rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-500">Yuborib bo'lmadi. Qaytadan urinib ko'ring.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl bg-tg-bg py-2.5 text-sm font-medium text-tg-hint"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={!reason.trim() || isPending}
          className="flex-[2] rounded-xl bg-role-director-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Yuborilmoqda..." : "Qayta ishlashga qaytarish"}
        </button>
      </div>
    </form>
  );
}

function DeadlineHistorySection({ taskId }: { taskId: string }) {
  const { data: history, isError, refetch } = useQuery({
    queryKey: ["deadline-history", taskId],
    queryFn: () => getDeadlineHistory(taskId),
  });

  if (isError) {
    return (
      <QueryError message="Deadline tarixini yuklab bo'lmadi." onRetry={() => refetch()} />
    );
  }

  if (!history || history.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-tg-hint">
        <History size={14} aria-hidden="true" /> Deadline tarixi
      </h2>
      <div className="flex flex-col gap-2">
        {history.map((h) => (
          <div key={h.id} className="rounded-2xl bg-tg-secondaryBg p-3 text-xs text-tg-text">
            <div className="flex items-center justify-between text-tg-hint">
              <span>{new Date(h.changed_at).toLocaleString("uz-UZ")}</span>
            </div>
            <p className="mt-1">
              {h.old_deadline ? new Date(h.old_deadline).toLocaleString("uz-UZ") : "—"}
              {" → "}
              {h.new_deadline ? new Date(h.new_deadline).toLocaleString("uz-UZ") : "—"}
            </p>
            {h.reason && <p className="mt-1 text-tg-hint">{h.reason}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isRejecting, setIsRejecting] = useState(false);
  useTelegramBackButton("/tasks");

  const { data: task, isLoading, isError, refetch } = useQuery({
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["task", taskId] });
      const previous = queryClient.getQueryData<typeof task>(["task", taskId]);
      queryClient.setQueryData(["task", taskId], (old: typeof task) =>
        old ? { ...old, status: "accepted" as const } : old
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      WebApp.HapticFeedback.notificationOccurred("success");
      showSuccess("Vazifa qabul qilindi.");
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["task", taskId], context.previous);
      }
      WebApp.HapticFeedback.notificationOccurred("error");
      showError("Vazifani qabul qilib bo'lmadi.");
    },
  });

  // Foydalanuvchi faylni bot orqali topshirish uchun Telegram'ga chiqib
  // qaytganda (Mini App fon/old planga qaytishi), vazifa holatini qayta
  // so'raymiz — aks holda ekranda eskirgan status ko'rinib qolishi mumkin.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && taskId) {
        queryClient.invalidateQueries({ queryKey: ["task", taskId] });
        queryClient.invalidateQueries({ queryKey: ["deadline-history", taskId] });
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [taskId, queryClient]);

  if (isLoading) {
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  }

  if (isError || !task) {
    return (
      <div className="p-5">
        <QueryError message="Vazifani yuklab bo'lmadi." onRetry={() => refetch()} />
      </div>
    );
  }

  const isAssignee = task.assigned_to === user?.id;
  // MUHIM: bu global admin tekshiruvi emas — backend har bir vazifa uchun
  // shu loyihaning rejissyori (director_main/extra) yoki admin/super_admin
  // ekanini hisoblab qaytaradi. Shu tufayli loyiha rejissyorlari ham
  // (admin bo'lmasa-da) vazifani qabul qilish/qaytarish huquqiga ega.
  const canAct = task.can_manage;
  const canAccept = canAct && task.status === "submitted";
  const canReject = canAct && task.status === "submitted";

  function openSubmissionInBot() {
    if (!config?.bot_username || !task) return;
    WebApp.HapticFeedback.impactOccurred("light");
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

      <div className="flex items-center gap-4 rounded-2xl bg-tg-secondaryBg p-4">
        {task.deadline &&
          (task.status === "pending" ||
            task.status === "revision_requested" ||
            task.status === "delayed") && <DeadlineRing deadline={task.deadline} />}
        <dl className="flex flex-1 flex-col gap-2 text-sm">
          {task.deadline && (
            <div className="flex justify-between">
              <dt className="text-tg-hint">Deadline</dt>
              <dd className="font-mono text-tg-text">
                {new Date(task.deadline).toLocaleString("uz-UZ")}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-tg-hint">Versiya</dt>
            <dd className="font-mono text-tg-text">v{task.current_version}</dd>
          </div>
        </dl>
      </div>

      {task.status === "revision_requested" && task.revision_reason && (
        <div className="rounded-2xl bg-role-director-50 p-4 text-sm text-role-director-800 dark:bg-role-director-900/50 dark:text-role-director-400">
          <p className="font-medium">Qayta topshirish sababi:</p>
          <p className="mt-1">{task.revision_reason}</p>
        </div>
      )}

      {isAssignee &&
        // MUHIM: bu ro'yxat backend'dagi api/services/file_service.py va
        // bot/handlers/file_submit.py'dagi _SUBMITTABLE_STATUSES bilan bir
        // xil bo'lishi shart — aks holda foydalanuvchi backend ruxsat
        // bergan holatda ham Mini App'da "Fayl topshirish" tugmasini
        // ko'rmay qoladi (masalan 'delayed' — deadline o'tib ketgan, lekin
        // hali topshirish mumkin bo'lgan tasklar uchun).
        (task.status === "pending" ||
          task.status === "revision_requested" ||
          task.status === "delayed" ||
          task.status === "submitted") && (
        <button
          onClick={openSubmissionInBot}
          disabled={!config?.bot_username}
          className="flex items-center justify-center gap-2 rounded-xl bg-tg-button px-4 py-3 text-sm font-medium text-tg-buttonText disabled:opacity-50"
        >
          <Upload size={16} aria-hidden="true" /> Fayl topshirish
        </button>
      )}

      {(canAccept || canReject) && !isRejecting && (
        <div className="flex gap-2">
          {canAccept && (
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-role-sound-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              <CheckCircle2 size={16} aria-hidden="true" /> Qabul qilish
            </button>
          )}
          {canReject && (
            <button
              onClick={() => {
                WebApp.HapticFeedback.impactOccurred("light");
                setIsRejecting(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-role-director-600 px-4 py-3 text-sm font-medium text-white"
            >
              <RotateCcw size={16} aria-hidden="true" /> Qaytarish
            </button>
          )}
        </div>
      )}

      {isRejecting && (
        <RequestRevisionForm taskId={task.id} onDone={() => setIsRejecting(false)} />
      )}

      {(canAct || isAssignee) && <DeadlineHistorySection taskId={task.id} />}
    </div>
  );
}
