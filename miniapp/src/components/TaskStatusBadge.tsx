import { CheckCircle2, Clock, RotateCcw, Send, AlertCircle } from "lucide-react";
import type { TaskStatus } from "@/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  revision_requested: "Qayta topshirish",
  delayed: "Kechikkan",
  pending: "Kutilmoqda",
  submitted: "Topshirilgan",
  accepted: "Qabul qilingan",
};

const STATUS_ICON: Record<TaskStatus, typeof Clock> = {
  revision_requested: RotateCcw,
  delayed: AlertCircle,
  pending: Clock,
  submitted: Send,
  accepted: CheckCircle2,
};

// Studiya rol-rang tizimidan olingan status ranglari: kutilmoqda = neytral,
// topshirilgan = tarjimon (indigo), qabul qilingan = montaj (teal),
// qayta topshirish/kechikkan = rejissyor/ovoz ranglari (ogohlantiruvchi).
const STATUS_CLASS: Record<TaskStatus, string> = {
  revision_requested: "bg-role-director-50 text-role-director-800",
  delayed: "bg-role-voice-50 text-role-voice-800",
  pending: "bg-tg-secondaryBg text-tg-hint",
  submitted: "bg-role-translator-50 text-role-translator-800",
  accepted: "bg-role-sound-50 text-role-sound-800",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
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
