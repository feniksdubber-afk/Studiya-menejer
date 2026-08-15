import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { getDeadlineHistory, getTask, requestRevision, setTaskStatus } from "@/api/tasks";
import { getPublicConfig } from "@/api/config";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { useAuth } from "@/auth/useAuth";

const TASK_TYPE_LABEL: Record<string, string> = {
  translation: "Tarjima",
  voice: "Ovoz",
  sound_video: "Video montaj",
  sound_audio: "Audio montaj",
};

function RequestRevisionForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
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
      onDone();
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
        <label className="text-xs font-medium text-tg-hint">Qaytarish sababi</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Nima to'g'irlanishi kerak?"
          rows={3}
          autoFocus
          className="resize-none rounded-xl bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-tg-hint">Yangi deadline (ixtiyoriy)</label>
        <input
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
          className="flex-[2] rounded-xl bg-orange-500 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Yuborilmoqda..." : "Qayta ishlashga qaytarish"}
        </button>
      </div>
    </form>
  );
}

function DeadlineHistorySection({ taskId }: { taskId: string }) {
  const { data: history } = useQuery({
    queryKey: ["deadline-history", taskId],
    queryFn: () => getDeadlineHistory(taskId),
  });

  if (!history || history.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-tg-hint">🕓 Deadline tarixi</h2>
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
  const [isRejecting, setIsRejecting] = useState(false);

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
  // MUHIM: bu global admin tekshiruvi emas — backend har bir vazifa uchun
  // shu loyihaning rejissyori (director_main/extra) yoki admin/super_admin
  // ekanini hisoblab qaytaradi. Shu tufayli loyiha rejissyorlari ham
  // (admin bo'lmasa-da) vazifani qabul qilish/qaytarish huquqiga ega.
  const canAct = task.can_manage;
  const canAccept = canAct && task.status === "submitted";
  const canReject = canAct && task.status === "submitted";

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

      {(canAccept || canReject) && !isRejecting && (
        <div className="flex gap-2">
          {canAccept && (
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              ✅ Qabul qilish
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setIsRejecting(true)}
              className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white"
            >
              🔄 Qaytarish
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
