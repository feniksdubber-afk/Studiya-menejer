import type { TaskStatus } from "@/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  revision_requested: "🔄 Qayta topshirish",
  delayed: "🔴 Kechikkan",
  pending: "📋 Kutilmoqda",
  submitted: "📤 Topshirilgan",
  accepted: "✅ Qabul qilingan",
};

const STATUS_CLASS: Record<TaskStatus, string> = {
  revision_requested: "bg-orange-100 text-orange-700",
  delayed: "bg-red-100 text-red-700",
  pending: "bg-tg-secondaryBg text-tg-hint",
  submitted: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Deadline yaqinligini aniqlash uchun yordamchi (frontendda hisoblanadi,
// "delayed"/"revision_requested" kabi backend statuslaridan farqli —
// bular shunchaki UI guruhlash uchun, backendda alohida status emas).
export function isDeadlineSoon(deadline: string | null): boolean {
  if (!deadline) return false;
  const hoursLeft = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursLeft > 0 && hoursLeft <= 24;
}
