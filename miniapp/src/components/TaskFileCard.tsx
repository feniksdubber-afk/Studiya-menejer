import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, Loader2, Music, Send, Video } from "lucide-react";
import { sendFileToMe } from "@/api/files";
import { useToast } from "@/components/Toast";
import type { TaskFile } from "@/types";

// Fayl kengaytmasi/mime turiga qarab pleer turini tanlash. Telegram
// hujjatlarda mime_type ba'zan bo'sh bo'lishi mumkin — shu holda fayl
// nomidagi kengaytmaga qaraymiz (video/audio uchun eng ehtimolli holat).
function detectKind(file: TaskFile): "video" | "audio" | "other" {
  const mime = file.mime_type ?? "";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const name = file.current_name.toLowerCase();
  if (/\.(mp4|mov|mkv|webm|avi)$/.test(name)) return "video";
  if (/\.(mp3|wav|ogg|m4a|flac|aac|opus)$/.test(name)) return "audio";
  return "other";
}

// Standart Telegram Bot API getFile chegarasi — undan katta fayllarni
// backend ham, Mini App ham ocha olmaydi (faqat bot chatida mavjud).
const TELEGRAM_FILE_LIMIT_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

/** Bitta topshirilgan/oldingi bosqich faylini ko'rsatadigan karta:
 *  video/audio uchun ichki pleer, hujjatlar uchun yuklab olish havolasi. */
export function TaskFileCard({
  title,
  file,
  accentClassName = "bg-tg-secondaryBg text-tg-text",
  onExpired,
}: {
  title: string;
  file: TaskFile;
  /** Rolga mos rang (masalan role-translator-50/800) — vizual ajratish uchun. */
  accentClassName?: string;
  /** Havola eskirganda (stream 401) yangi havola olish uchun — odatda query refetch. */
  onExpired?: () => void;
}) {
  const kind = detectKind(file);
  const { showSuccess, showError } = useToast();
  const [retriedUrl, setRetriedUrl] = useState<string | null>(null);
  const sendMutation = useMutation({
    mutationFn: () => sendFileToMe(file.file_id),
    onSuccess: () => showSuccess("Fayl bot chatiga yuborildi"),
    onError: (err: any) => showError(err?.response?.data?.detail ?? "Faylni yuborib bo'lmadi"),
  });

  // Media xatosi: avval (bir marta) yangi havola olishga urinamiz — odatda sabab
  // havola muddati o'tgani. Yangi havola ham ishlamasa, xabar ko'rsatamiz.
  function handleMediaError() {
    if (onExpired && retriedUrl !== file.file_url) {
      setRetriedUrl(file.file_url);
      onExpired();
      return;
    }
    setFailedUrl(file.file_url);
  }
  // Xato aynan shu havola uchun eslab qolinadi — karta boshqa fayl bilan qayta
  // ishlatilsa, eski xato yangi faylni yashirib qo'ymaydi.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const mediaFailed = failedUrl === file.file_url;
  const tooLarge = file.file_size != null && file.file_size > TELEGRAM_FILE_LIMIT_BYTES;
  const unavailable = tooLarge || mediaFailed;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-tg-secondaryBg p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${accentClassName}`}>
          {kind === "video" ? <Video size={13} aria-hidden="true" /> : kind === "audio" ? <Music size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
          {title}
        </span>
        <span className="font-mono text-xs text-tg-hint">v{file.version_number}</span>
      </div>

      {unavailable && (
        <div
          role={mediaFailed ? "alert" : "status"}
          className="flex items-start gap-2 rounded-xl bg-tg-bg p-3 text-xs leading-relaxed text-tg-hint"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {tooLarge
              ? "Fayl 20 MB dan katta — Mini App ichida ochib bo'lmaydi. Uni botdan o'zingizga yuborishingiz mumkin."
              : "Faylni ochib bo'lmadi. Havola eskirgan bo'lishi mumkin — sahifani yangilang."}
          </span>
        </div>
      )}

      {!unavailable && kind === "video" && (
        <video
          src={file.file_url}
          controls
          playsInline
          onError={handleMediaError}
          className="w-full rounded-xl bg-black"
        />
      )}

      {!unavailable && kind === "audio" && (
        <audio src={file.file_url} controls onError={handleMediaError} className="w-full" />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-tg-text">{file.current_name}</span>
          {file.file_size != null && (
            <span className="text-xs text-tg-hint">{formatBytes(file.file_size)}</span>
          )}
        </div>
        {tooLarge ? (
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-tg-bg px-3 text-xs font-medium text-tg-button active:opacity-70 disabled:opacity-50"
          >
            {sendMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={14} aria-hidden="true" />
            )}{" "}
            Botga yuborish
          </button>
        ) : (
          <a
            href={`${file.file_url}&download=1`}
            download={file.current_name}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-tg-bg px-3 text-xs font-medium text-tg-button active:opacity-70"
          >
            <Download size={14} aria-hidden="true" /> Yuklab olish
          </a>
        )}
      </div>
    </div>
  );
}

/** `queryFn` chaqirib, natijani (yoki yo'qligini/xatoni) TaskFileCard bilan
 *  ko'rsatuvchi wrapper — har bir ishlatilish joyida loading/empty/error
 *  holatlarini takrorlamaslik uchun. */
export function TaskFileSection({
  title,
  emptyMessage,
  accentClassName,
  queryKey,
  queryFn,
}: {
  title: string;
  emptyMessage: string;
  accentClassName?: string;
  queryKey: unknown[];
  queryFn: () => Promise<TaskFile | null>;
}) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey, queryFn });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-tg-secondaryBg p-4 text-sm text-tg-hint">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Fayl tekshirilmoqda...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-tg-secondaryBg p-4 text-sm text-tg-hint">
        {title}ni yuklab bo'lmadi.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-tg-secondaryBg p-4 text-sm text-tg-hint">{emptyMessage}</div>
    );
  }

  return <TaskFileCard title={title} file={data} accentClassName={accentClassName} onExpired={() => void refetch()} />;
}
